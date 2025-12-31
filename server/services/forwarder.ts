/**
 * معالج توجيه الرسائل
 * هذا الملف سيحتوي على منطق توجيه الرسائل
 * من مصادر متعددة إلى أهداف متعددة
 */

import { storage } from "../storage";
import type { Task, Log } from "@shared/schema";

export interface ForwardingResult {
  messageId: string;
  success: boolean;
  details?: string;
  timestamp: Date;
}

/**
 * معالج التوجيه الأساسي
 * هذا الهيكل سيتم توسيعه لاحقاً مع Pyrogram
 */
export class MessageForwarder {
  /**
   * توجيه رسالة واحدة إلى وجهات متعددة
   */
  async forwardMessage(
    task: Task,
    messageId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ForwardingResult[]> {
    const results: ForwardingResult[] = [];

    // التحقق من نشاط المهمة
    if (!task.isActive) {
      return [{
        messageId,
        success: false,
        details: `Task ${task.name} (ID: ${task.id}) is inactive`,
        timestamp: new Date(),
      }];
    }

    console.log(`[Forwarder] Task "${task.name}" (ID: ${task.id}) processing message ${messageId}`);

    // معالجة كل وجهة
    for (const destination of task.destinationChannels) {
      try {
        // التحقق من الفلاتر الخاصة بالمهمة
        const filters = task.filters as any;
        if (!this.applyFilters(content, filters, metadata)) {
          console.log(`[Forwarder] Message ${messageId} skipped by filters for task "${task.name}"`);
          
          await storage.createLog({
            taskId: task.id,
            sourceChannel: metadata?.fromChatId?.toString() || task.sourceChannels[0],
            destinationChannel: destination,
            messageId,
            status: "skipped",
            details: "Filtered by keywords",
          });

          continue;
        }

        // تطبيق التنسيقات والخيارات الخاصة بالمهمة
        let finalContent = content;
        const options = task.options as any;

        if (options?.addSignature) {
          finalContent = this.addSignature(finalContent, options.addSignature);
        }

        const result = await this.sendToDestination(
          task.sessionId,
          destination,
          finalContent,
          {
            ...metadata,
            taskId: task.id,
            taskName: task.name
          }
        );

        // تسجيل السجل
        await storage.createLog({
          taskId: task.id,
          sourceChannel: metadata?.fromChatId?.toString() || task.sourceChannels[0],
          destinationChannel: destination,
          messageId,
          status: result.success ? "success" : "failed",
          details: result.details,
        });

        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        await storage.createLog({
          taskId: task.id,
          sourceChannel: metadata?.fromChatId?.toString() || task.sourceChannels[0],
          destinationChannel: destination,
          messageId,
          status: "failed",
          details: errorMessage,
        });

        results.push({
          messageId,
          success: false,
          details: errorMessage,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * توجيه ألبوم (مجموعة وسائط) كرسائل جديدة لإخفاء مصدر التوجيه
   */
  async forwardAlbum(
    task: Task,
    messageIds: number[],
    sourceChatId: string
  ): Promise<ForwardingResult[]> {
    const results: ForwardingResult[] = [];
    const { getTelegramClient } = await import("./telegram");
    const client = await getTelegramClient(task.sessionId);

    if (!client) {
      throw new Error("No active client for session");
    }

    for (const destination of task.destinationChannels) {
      try {
        console.log(`[Forwarder] Sending album (${messageIds.length} items) as new messages to ${destination}`);
        
        // Fetch all message objects to get their media
        const { getTelegramClient } = await import("./telegram");
        const clientInstance = await getTelegramClient(task.sessionId);
        
        if (!clientInstance) {
          throw new Error("No active client for session during album fetch");
        }
        
        const messages = await clientInstance.getMessages(sourceChatId, { ids: messageIds });
        
        // Extract the first non-empty caption from the album
        let albumCaption = "";
        let albumEntities = undefined;
        for (const msg of messages) {
          const text = msg.message || msg.text || "";
          if (text.trim().length > 0) {
            albumCaption = text;
            albumEntities = msg.entities;
            break;
          }
        }
        
        // Use the media objects directly from the fetched messages
        // We use formattingEntities to preserve all complex formatting like blockquotes and spoilers
        // IMPORTANT: We must also pass formattingEntities to allow Telegram to process the entities correctly
        await clientInstance.sendMessage(destination, {
          file: messages.map(msg => msg.media).filter(media => !!media),
          message: albumCaption,
          formattingEntities: albumEntities,
        });

        await storage.createLog({
          taskId: task.id,
          sourceChannel: sourceChatId,
          destinationChannel: destination,
          messageId: `album_${messageIds[0]}`,
          status: "success",
          details: `Album sent as new messages successfully (${messageIds.length} items)`,
        });

        results.push({
          messageId: `album_${messageIds[0]}`,
          success: true,
          details: "Album sent as new messages successfully",
          timestamp: new Date(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Forwarder] Failed to send album to ${destination}:`, errorMessage);
        
        results.push({
          messageId: `album_${messageIds[0]}`,
          success: false,
          details: errorMessage,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * إرسال رسالة إلى وجهة واحدة
   */
  private async sendToDestination(
    sessionId: number,
    destination: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ForwardingResult> {
    try {
      const { getTelegramClient } = await import("./telegram");
      const client = await getTelegramClient(sessionId);
      
      if (!client) {
        throw new Error("No active client for session");
      }

      // If it has media, we'll send it as a NEW message using the file property
      // this hides the "Forwarded from" tag and creates a clean copy
      if (metadata?.hasMedia && metadata?.originalMessageId && metadata?.fromChatId) {
        console.log(`[Forwarder] Sending media ${metadata.originalMessageId} as new message to ${destination}`);
        
        const sourcePeer = await client.getInputEntity(metadata.fromChatId);
        
        await client.sendMessage(destination, {
          file: metadata.rawMessage.media,
          message: metadata.originalText || content,
          formattingEntities: metadata.entities
        });
        
        return {
          messageId: metadata.originalMessageId.toString(),
          success: true,
          details: "Media sent as new message successfully",
          timestamp: new Date(),
        };
      }

      // Fallback to sending text if no media
      const entity = await client.getEntity(destination);
      const messageOptions: any = {};

      if (metadata?.entities) {
        messageOptions.formattingEntities = metadata.entities;
      } else {
        messageOptions.parseMode = "html";
      }

      const finalMessage = (content && content.trim().length > 0) ? content : " .";

      const result = await client.sendMessage(entity, {
        message: finalMessage,
        ...messageOptions
      });
      
      return {
        messageId: result.id?.toString() || `${Date.now()}`,
        success: true,
        details: "Message sent successfully",
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Forwarder] Failed to send to ${destination}:`, errorMsg);
      
      return {
        messageId: metadata?.originalMessageId?.toString() || `${Date.now()}`,
        success: false,
        details: errorMsg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * تطبيق الفلاتر على الرسائل
   */
  applyFilters(
    content: string,
    filters?: Record<string, any>,
    metadata?: Record<string, any>
  ): boolean {
    if (!filters) return true;

    // فحص نوع الوسائط
    if (filters.mediaTypes && metadata) {
      const type = metadata.type as string;
      const mediaTypes = filters.mediaTypes as Record<string, boolean>;
      
      // إذا كان النوع غير مسموح به، نتخطى الرسالة
      if (type && mediaTypes[type] === false) {
        return false;
      }
    }

    // فلتر الكلمات المفتاحية (فقط للرسائل النصية أو التي تحتوي على نص)
    if (content) {
      if (filters.keywords && filters.keywords.length > 0) {
        const hasKeyword = filters.keywords.some(
          (keyword: string) => content.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      // استبعاد الكلمات
      if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
        const hasExcludedKeyword = filters.excludeKeywords.some(
          (keyword: string) => content.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasExcludedKeyword) return false;
      }
    }

    return true;
  }

  /**
   * تطبيق التنسيقات المتقدمة
   * (bold, italic, code, spoiler, etc)
   */
  applyFormatting(
    content: string,
    formats: string[] = []
  ): string {
    let result = content;

    for (const format of formats) {
      switch (format) {
        case "bold":
          result = `**${result}**`;
          break;
        case "italic":
          result = `__${result}__`;
          break;
        case "code":
          result = "`" + result + "`";
          break;
        case "spoiler":
          result = `||${result}||`;
          break;
        case "quote":
          result = `> ${result}`;
          break;
      }
    }

    return result;
  }

  /**
   * إضافة توقيع أو ملاحظة إلى الرسالة
   */
  addSignature(
    content: string,
    signature?: string
  ): string {
    if (!signature) return content;
    return `${content}\n\n---\n${signature}`;
  }
}

export const forwarder = new MessageForwarder();
