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
        details: "Task is inactive",
        timestamp: new Date(),
      }];
    }

    // معالجة كل وجهة
    for (const destination of task.destinationChannels) {
      try {
        // هنا سيتم إضافة منطق التوجيه الفعلي مع Pyrogram
        const result = await this.sendToDestination(
          task.sessionId,
          destination,
          content,
          metadata
        );

        // تسجيل السجل
        await storage.createLog({
          taskId: task.id,
          sourceChannel: task.sourceChannels[0],
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
          sourceChannel: task.sourceChannels[0],
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

      // Send message to destination
      const entity = await client.getEntity(destination);
      const result = await client.sendMessage(entity, {
        message: content,
        parseMode: "html"
      });
      
      console.log(`[Forwarder] Message sent to ${destination}:`, result.id);
      
      return {
        messageId: result.id?.toString() || `${Date.now()}`,
        success: true,
        details: "Message forwarded successfully",
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
    filters?: Record<string, any>
  ): boolean {
    if (!filters) return true;

    // فلتر الكلمات المفتاحية
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
