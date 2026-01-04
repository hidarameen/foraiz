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
    const taskData = await storage.getTask(task.id);
    if (!taskData) {
      console.error(`[Forwarder] Task ${task.id} not found in database!`);
    }
    const filters = (taskData?.filters || task.filters) as any;
    const aiFiltersConfig = filters?.aiFilters;
    const rulesForMode = aiFiltersConfig?.mode === 'whitelist' 
      ? (aiFiltersConfig?.whitelistRules || [])
      : (aiFiltersConfig?.blacklistRules || []);
    console.log(`[Forwarder] Processing message ${messageId} for task ${task.id}. AI Rules count (${aiFiltersConfig?.mode}): ${rulesForMode.length || 0}`);
    if (rulesForMode && rulesForMode.length > 0) {
      console.log(`[Forwarder] Active Rule 1 Instruction: "${rulesForMode[0].instruction}"`);
    }
    const filterResult = await this.applyFilters(content, filters, metadata);
    
    console.log(`[Forwarder] Filter analysis completed for message ${messageId}. Result: ${filterResult.allowed ? 'ALLOWED' : 'BLOCKED'}`);

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

        // 1. إعادة صياغة الرسالة بالذكاء الاصطناعي (AI Rewrite)
        if (options?.aiRewrite?.isEnabled) {
          console.log(`[Forwarder] AI Rewrite triggered for task ${task.id}. Content length: ${finalContent?.length || 0}`);
          const rules = Array.isArray(options.aiRewrite.rules) ? options.aiRewrite.rules : [];
          const rewriteRules = rules
            .filter((r: any) => r && r.isActive && r.name && r.instruction)
            .map((r: any) => `- ${r.name}: ${r.instruction}`)
            .join('\n');

          if (rewriteRules.length > 0 && finalContent && finalContent.trim().length > 0) {
            console.log(`[Forwarder] AI Rewrite processing message with ${rules.filter((r:any)=>r.isActive).length} active rules`);
            const prompt = `أنت خبير في إعادة صياغة وتحرير النصوص. مهمتك هي إعادة صياغة الرسالة التالية بناءً على القواعد المحددة.
يجب أن تحافظ على الجوهر الأساسي للرسالة مع تطبيق التعديلات المطلوبة بدقة.

الرسالة الأصلية: "${finalContent}"

القواعد المطلوبة لإعادة الصياغة:
${rewriteRules}

المطلوب منك:
إعادة صياغة الرسالة بالكامل وتطبيق القواعد عليها، والرد بنص الرسالة الجديد فقط دون أي مقدمات أو شروحات.`;

            try {
              // Get all active configs to find the first working one if the specific one isn't active
              const allConfigs = await storage.getAIConfigs();
              const aiConfig = allConfigs.find(c => c.provider === options.aiRewrite.provider && c.isActive);
              const apiKey = aiConfig?.apiKey || process.env[`${options.aiRewrite.provider.toUpperCase()}_API_KEY`];

              if (apiKey) {
                const rewritten = await AIService.chat(options.aiRewrite.provider, options.aiRewrite.model, prompt, apiKey);
                const rewrittenStr = typeof rewritten === 'string' ? rewritten : (rewritten as any)?.message || "";
                if (rewrittenStr && rewrittenStr.trim().length > 0) {
                  finalContent = rewrittenStr.trim();
                  console.log(`[Forwarder] AI Rewrite Success for task ${task.id}. Content length: ${finalContent.length}`);
                } else {
                  console.log(`[Forwarder] AI Rewrite returned empty or invalid response:`, rewritten);
                }
              } else {
                console.error(`[Forwarder] API Key not found for provider: ${options.aiRewrite.provider}`);
              }
            } catch (error) {
              console.error(`[Forwarder] AI Rewrite failed for task ${task.id}:`, error);
            }
          } else {
            const rulesLength = options.aiRewrite.rules?.length || 0;
            const activeRulesLength = (options.aiRewrite.rules || []).filter((r:any) => r.isActive).length;
            console.log(`[Forwarder] AI Rewrite skipped: Rules length: ${rulesLength}, Active: ${activeRulesLength}, Content length: ${finalContent.trim().length}`);
          }
        }

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
        // Ensure destination is standardized
        let target: any = destination;
        if (/^\d+$/.test(destination) && destination.length > 5 && !destination.startsWith("-")) {
          target = "-100" + destination;
          console.log(`[Forwarder] 🔄 Standardizing destination ${destination} -> ${target} for media`);
        }

        console.log(`[Forwarder] Sending media as new message to ${target}`);
        
        await client.sendMessage(target, {
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
      // Ensure destination is a valid numeric ID (standardized with -100)
      let target: any = destination;
      if (/^\d+$/.test(destination) && destination.length > 5 && !destination.startsWith("-")) {
        target = "-100" + destination;
        console.log(`[Forwarder] 🔄 Standardizing destination ${destination} -> ${target}`);
      }

      const entity = await client.getEntity(target);
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
    const aiFilters = filters?.aiFilters;
    if (aiFilters?.isEnabled) {
      const rulesArray = aiFilters.mode === 'whitelist' 
        ? (aiFilters.whitelistRules || [])
        : (aiFilters.blacklistRules || []);
      
      if (rulesArray.length > 0) {
        const activeRules = rulesArray
          .filter((r: any) => r.isActive)
          .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));

        const textToAnalyze = content || metadata?.originalText || "";

        if (activeRules.length > 0 && textToAnalyze.trim().length > 0) {
        const rulesDescription = activeRules.map((r: any) => `- ${r.name}: ${r.instruction}`).join('\n');
        
        const prompt = `أنت خبير في تحليل المحتوى وفهم السياق، مهمتك هي تقييم الرسائل بناءً على القواعد المحددة.
يجب أن تعتمد في قرارك على الفهم العميق للمعنى والسياق العام للرسالة، وليس فقط مطابقة الكلمات بشكل حرفي.

الرسالة المراد تحليلها: "${textToAnalyze}"

القواعد المطلوبة:
${rulesDescription}

الوضع الحالي للفلاتر: ${aiFilters.mode === 'whitelist' ? 'سماح فقط بما يطابق القواعد (Whitelist)' : 'منع ما يطابق القواعد (Blacklist)'}

المطلوب منك:
1. تحليل الرسالة بعناية وفهم القصد منها.
2. تقرير ما إذا كانت الرسالة "تخالف" أو "تطابق" القواعد بناءً على المعنى والسياق.
3. الرد بتنسيق محدد جداً:
   - ابدأ بكلمة "ALLOW" إذا كانت الرسالة مسموح بها.
   - ابدأ بكلمة "BLOCK" إذا كانت الرسالة يجب حظرها.
   - أضف فاصل "|" ثم اشرح سبب قرارك بناءً على تحليلك للسياق (باللغة العربية).

مثال للرد: BLOCK | الرسالة تروج لخدمات تجارية بشكل غير مباشر رغم عدم وجود كلمات تسويقية صريحة.
مثال للرد: ALLOW | الرسالة إخبارية بحتة ولا تحتوي على محتوى تحريضي كما هو محظور في القواعد.`;

        try {
          const allConfigs = await storage.getAIConfigs();
          const aiConfig = allConfigs.find(c => c.provider === aiFilters.provider && c.isActive);
          const apiKey = aiConfig?.apiKey || process.env[`${aiFilters.provider.toUpperCase()}_API_KEY`];

          if (apiKey) {
            console.log(`[Forwarder] AI Request Start - Provider: ${aiFilters.provider}, Model: ${aiFilters.model}, Mode: ${aiFilters.mode}`);
            console.log(`[Forwarder] AI Prompt sent:\n${prompt}`);
            
            const startTime = Date.now();
            const response = await AIService.chat(aiFilters.provider, aiFilters.model, prompt, apiKey);
            const duration = Date.now() - startTime;
            
            console.log(`[Forwarder] AI Response received in ${duration}ms:`, JSON.stringify(response, null, 2));
            
            // Handle different response structures from providers
            let decision = "";
            if (typeof response === 'string') {
              decision = (response as string).toUpperCase();
            } else if (response && typeof response === 'object') {
              decision = (response as any).message?.toUpperCase() || JSON.stringify(response).toUpperCase();
            }
            
            console.log(`[Forwarder] AI Normalized Decision: ${decision}`);
            
            // Normalize decision string
            const upperDecision = decision.split('|')[0].trim().toUpperCase();
            
            if (upperDecision.includes("BLOCK")) {
              const reason = decision.split('|')[1]?.trim() || "محتوى غير مرغوب فيه";
              console.log(`[Forwarder] AI Decision: BLOCK, Reason: ${reason}`);
              return { allowed: false, reason: `حظر بواسطة الذكاء الاصطناعي: ${reason}` };
            }
            
            if (aiFilters.mode === 'whitelist' && !upperDecision.includes("ALLOW")) {
              console.log(`[Forwarder] AI Decision: BLOCK (Whitelist failure)`);
              return { allowed: false, reason: "حظر بواسطة الذكاء الاصطناعي: لم يطابق قواعد السماح (Whitelist)" };
            }
            
            console.log(`[Forwarder] AI Decision: ALLOW`);
          } else {
            console.error(`[Forwarder] AI Filter enabled but no active API key found for ${aiFilters.provider} in database or environment`);
            // Fallback: If AI is mandatory but fails due to config, we might want to log it
          }
        } catch (error) {
          console.error(`[Forwarder] AI Filtering failed:`, error);
        }
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
