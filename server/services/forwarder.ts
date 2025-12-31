/**
 * معالج توجيه الرسائل
 * هذا الملف سيحتوي على منطق توجيه الرسائل
 * من مصادر متعددة إلى أهداف متعددة
 */

import { storage } from "../storage";
import type { Task, Log } from "@shared/schema";
import { AIService } from "./ai";

export interface ForwardingResult {
  messageId: string;
  success: boolean;
  details?: string;
  timestamp: Date;
}

/**
 * معالج التوجيه الأساسي
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

    // التحقق من الفلاتر العامة للمهمة قبل البدء في التوجيه لكل وجهة
    const filters = task.filters as any;
    const filterResult = await this.applyFilters(content, filters, metadata);
    if (!filterResult.allowed) {
      console.log(`[Forwarder] Message ${messageId} skipped by filters for task "${task.name}": ${filterResult.reason}`);
      
      await storage.createLog({
        taskId: task.id,
        sourceChannel: metadata?.fromChatId?.toString() || task.sourceChannels[0],
        destinationChannel: "Filtered Out",
        messageId,
        status: "skipped",
        details: filterResult.reason || "Filtered by criteria",
      });

      return results;
    }

    // معالجة كل وجهة
    for (const destination of task.destinationChannels) {
      try {
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
        const messages = await client.getMessages(sourceChatId, { ids: messageIds });
        
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
        await client.sendMessage(destination, {
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
      if (metadata?.hasMedia && metadata?.rawMessage?.media) {
        console.log(`[Forwarder] Sending media as new message to ${destination}`);
        
        await client.sendMessage(destination, {
          file: metadata.rawMessage.media,
          message: metadata.originalText || content,
          formattingEntities: metadata.entities
        });
        
        return {
          messageId: metadata.originalMessageId?.toString() || "media",
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
  async applyFilters(
    content: string,
    filters?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!filters) return { allowed: true };

    // 1. فحص نوع الوسائط
    if (filters.mediaTypes && metadata) {
      const mediaTypes = filters.mediaTypes as Record<string, boolean>;
      const isInvalid = !mediaTypes || Array.isArray(mediaTypes) || Object.keys(mediaTypes).length === 0;
      
      if (!isInvalid) {
        let filterKey = metadata.type as string;
        const rawMsg = metadata.rawMessage;
        if (rawMsg) {
          if (rawMsg.photo) filterKey = "photo";
          else if (rawMsg.video) filterKey = "video";
          else if (rawMsg.document) filterKey = "document";
          else if (rawMsg.audio) filterKey = "audio";
          else if (rawMsg.voice) filterKey = "voice";
          else if (rawMsg.sticker) filterKey = "sticker";
          else if (rawMsg.videoNote) filterKey = "videoNote";
          else if (rawMsg.gif || rawMsg.animation) filterKey = "animation";
          else if (rawMsg.poll) filterKey = "poll";
          else if (rawMsg.contact) filterKey = "contact";
          else if (rawMsg.location) filterKey = "location";
          else if (rawMsg.invoice) filterKey = "invoice";
          else if (!metadata.hasMedia) filterKey = "text";
        } else if (!metadata.hasMedia) {
          filterKey = "text";
        }

        if (filterKey && mediaTypes[filterKey] === false) {
          return { allowed: false, reason: `نوع الوسائط "${filterKey}" محظور` };
        }
      }
    }

    // 2. فلاتر الذكاء الاصطناعي
    const aiFilters = filters.aiFilters;
    if (aiFilters?.isEnabled && aiFilters.rules?.length > 0) {
      const activeRules = aiFilters.rules
        .filter((r: any) => r.isActive)
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));

      if (activeRules.length > 0 && (content || metadata?.originalText)) {
        const textToAnalyze = content || metadata?.originalText || "";
        const rulesDescription = activeRules.map((r: any) => `- ${r.name}: ${r.instruction}`).join('\n');
        
        const prompt = `أنت مساعد ذكي مهمتك فحص محتوى الرسائل وتحديد ما إذا كانت تطابق القواعد المحددة.
الرسالة: "${textToAnalyze}"

القواعد:
${rulesDescription}

الوضع الحالي: ${aiFilters.mode === 'whitelist' ? 'القائمة البيضاء (السماح فقط إذا طابقت القواعد)' : 'القائمة السوداء (الحظر إذا طابقت القواعد)'}

أجب بـ "ALLOW" للسماح بالرسالة أو "BLOCK" لحظرها، متبوعاً بسبب قصير جداً باللغة العربية.
مثال: BLOCK | المحتوى إعلاني`;

        try {
          const config = await storage.getAIConfigs();
          const activeConfig = config.find(c => c.provider === aiFilters.provider && c.isActive);
          const apiKey = activeConfig?.apiKey || process.env[`${aiFilters.provider.toUpperCase()}_API_KEY`];

          if (apiKey) {
            const response = await AIService.chat(aiFilters.provider, aiFilters.model, prompt, apiKey);
            const decision = response.toUpperCase();
            
            if (decision.includes("BLOCK")) {
              return { allowed: false, reason: `حظر بواسطة الذكاء الاصطناعي: ${decision.split('|')[1]?.trim() || "غير مطابق للقواعد"}` };
            }
            if (aiFilters.mode === 'whitelist' && !decision.includes("ALLOW")) {
              return { allowed: false, reason: "حظر بواسطة الذكاء الاصطناعي: لم يطابق قواعد السماح" };
            }
          } else {
            console.error(`[Forwarder] AI Filter enabled but no API key found for ${aiFilters.provider}`);
          }
        } catch (error) {
          console.error(`[Forwarder] AI Filtering failed:`, error);
        }
      }
    }

    return { allowed: true };
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
