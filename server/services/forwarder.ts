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
  private taskProcessedMessages = new Set<string>();

  /**
   * إعادة صياغة النص باستخدام الذكاء الاصطناعي
   */
  private async rewriteWithAI(
    task: Task,
    content: string,
    provider: string,
    model: string,
    rules: any[]
  ): Promise<string> {
    if (!content || content.trim().length === 0) return content;
    
    const activeRules = rules
      .filter((r: any) => r && r.isActive && r.name && r.instruction)
      .map((r: any) => `- ${r.name}: ${r.instruction}`)
      .join('\n');

    if (activeRules.length === 0) return content;

    try {
      const allConfigs = await storage.getAIConfigs();
      // Force OpenAI gpt-4o for reliability in rewriting
      let aiConfig = allConfigs.find(c => c.provider === 'openai' && c.isActive);
      if (!aiConfig) aiConfig = allConfigs.find(c => c.isActive);
      
      const providerToUse = aiConfig?.provider || 'openai';
      const modelToUse = (providerToUse === 'openai') ? 'gpt-4o' : 'gpt-4o';
      const apiKey = aiConfig?.apiKey || process.env[`${providerToUse.toUpperCase()}_API_KEY`];

      console.log(`[Forwarder] [rewriteWithAI] Requesting rewrite for task ${task.id}`);
      const prompt = `${activeRules}

الرسالة الأصلية: "${content}"

المطلوب منك:
إعادة صياغة الرسالة بالكامل وتطبيق القواعد المذكورة أعلاه عليها، والرد بنص الرسالة الجديد فقط دون أي مقدمات أو شروحات.`;

      if (apiKey) {
        console.log(`[Forwarder] [rewriteWithAI] Sending request - Provider: ${providerToUse}, Model: ${modelToUse}`);
        
        await storage.createLog({
          taskId: task.id,
          sourceChannel: "AI Service",
          destinationChannel: "Processing",
          messageId: `ai_rewrite_${Date.now()}`,
          status: "info",
          details: `بدء إعادة صياغة النص باستخدام ${providerToUse} (${modelToUse})`,
        });

        const response = await AIService.chat(providerToUse as any, modelToUse, prompt, apiKey);
        const rewrittenStr = typeof response === 'string' ? response : (response as any)?.message || "";
        
        if (rewrittenStr && rewrittenStr.trim().length > 0) {
          console.log(`[Forwarder] [rewriteWithAI] Success - Result length: ${rewrittenStr.trim().length}`);
          return rewrittenStr.trim();
        } else {
          console.warn(`[Forwarder] [rewriteWithAI] Received empty response`);
          await storage.createLog({
            taskId: task.id,
            sourceChannel: "AI Service",
            destinationChannel: "Warning",
            messageId: `ai_warn_${Date.now()}`,
            status: "failed",
            details: "رد الذكاء الاصطناعي كان فارغاً أثناء إعادة الصياغة",
          });
        }
      } else {
        console.error(`[Forwarder] [rewriteWithAI] No API Key found for ${providerToUse}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Forwarder] [rewriteWithAI] Error:`, error);
      await storage.createLog({
        taskId: task.id,
        sourceChannel: "AI Service",
        destinationChannel: "Error",
        messageId: `ai_error_${Date.now()}`,
        status: "failed",
        details: `خطأ في إعادة الصياغة: ${errorMsg}`,
      });
    }
    
    return content;
  }

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

    // Check if message was already processed for this specific task
    // Use task ID and message ID to prevent double forwarding
    const taskMsgKey = `task_${task.id}_msg_${messageId}`;
    if (this.taskProcessedMessages.has(taskMsgKey)) {
      console.log(`[Forwarder] ⏩ Message ${messageId} already processed by forwarder for task ${task.id}, skipping`);
      return [];
    }
    this.taskProcessedMessages.add(taskMsgKey);
    
    // Keep cache manageable (TTL-like)
    if (this.taskProcessedMessages.size > 10000) {
      const firstKey = this.taskProcessedMessages.values().next().value;
      if (firstKey) this.taskProcessedMessages.delete(firstKey);
    }

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
      return results; // Stop if task doesn't exist to avoid FK errors
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
    const filterResult = await this.applyFilters(content, filters, { ...metadata, taskId: task.id });
    
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

        // Ensure destination is standardized before check
        let target: string = destination;
        if (/^\d+$/.test(destination) && destination.length > 5 && !destination.startsWith("-")) {
          target = "-100" + destination;
          console.log(`[Forwarder] 🔄 Normalizing destination ${destination} -> ${target}`);
        }

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
            const prompt = `القواعد المطلوبة لإعادة الصياغة:
${rewriteRules}

الرسالة الأصلية: "${finalContent}"

المطلوب منك:
إعادة صياغة الرسالة بالكامل وتطبيق القواعد عليها، والرد بنص الرسالة الجديد فقط دون أي مقدمات أو شروحات.`;

            try {
              const allConfigs = await storage.getAIConfigs();
              // Try to find OpenAI config as it is the most reliable for rewriting
              let aiConfig = allConfigs.find(c => c.provider === 'openai' && c.isActive);
              if (!aiConfig) aiConfig = allConfigs.find(c => c.isActive);
              
              const providerToUse = aiConfig?.provider || options.aiRewrite.provider || 'openai';
              const modelToUse = (providerToUse === 'openai') ? 'gpt-4o' : (options.aiRewrite.model || 'gpt-4o');
              const apiKey = aiConfig?.apiKey || process.env[`${providerToUse.toUpperCase()}_API_KEY`];

              if (apiKey) {
                console.log(`[Forwarder] AI Rewrite Start - Task: ${task.id}, Provider: ${providerToUse}, Model: ${modelToUse}`);
                
                await storage.createLog({
                  taskId: task.id,
                  sourceChannel: "AI Service",
                  destinationChannel: "Processing",
                  messageId: `ai_rewrite_${Date.now()}`,
                  status: "info",
                  details: `بدء إعادة صياغة النص (خيار المهمة) باستخدام ${providerToUse}`,
                });

                const rewritten = await AIService.chat(providerToUse, modelToUse, prompt, apiKey);
                const rewrittenStr = typeof rewritten === 'string' ? rewritten : (rewritten as any)?.message || "";
                if (rewrittenStr && rewrittenStr.trim().length > 0) {
                  finalContent = rewrittenStr.trim();
                  console.log(`[Forwarder] AI Rewrite Success for task ${task.id}. Content length: ${finalContent.length}`);
                } else {
                  console.log(`[Forwarder] AI Rewrite returned empty or invalid response:`, rewritten);
                  await storage.createLog({
                    taskId: task.id,
                    sourceChannel: "AI Service",
                    destinationChannel: "Warning",
                    messageId: `ai_warn_${Date.now()}`,
                    status: "failed",
                    details: "رد الذكاء الاصطناعي كان فارغاً، تم استخدام النص الأصلي",
                  });
                }
              } else {
                const errorMsg = `API Key not found for provider: ${options.aiRewrite.provider}`;
                console.error(`[Forwarder] ${errorMsg}`);
                await storage.createLog({
                  taskId: task.id,
                  sourceChannel: "AI Service",
                  destinationChannel: "Error",
                  messageId: `ai_error_${Date.now()}`,
                  status: "failed",
                  details: `فشل العثور على مفتاح API لـ ${options.aiRewrite.provider}`,
                });
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : "Unknown error";
              console.error(`[Forwarder] AI Rewrite failed for task ${task.id}:`, error);
              await storage.createLog({
                taskId: task.id,
                sourceChannel: "AI Service",
                destinationChannel: "Error",
                messageId: `ai_error_${Date.now()}`,
                status: "failed",
                details: `فشل إعادة الصياغة: ${errorMsg}`,
              });
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
          target,
          finalContent,
          {
            ...metadata,
            taskId: task.id,
            taskName: task.name,
            task: taskData || task
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
        const fetchedTaskData = await storage.getTask(task.id);
        const options = (fetchedTaskData?.options || task.options) as any;
        let finalCaption = albumCaption;
        
        if (options?.aiRewrite?.isEnabled && finalCaption) {
          finalCaption = await this.rewriteWithAI(
            fetchedTaskData || task,
            finalCaption,
            options.aiRewrite.provider,
            options.aiRewrite.model,
            options.aiRewrite.rules || []
          );
        }

        await client.sendMessage(destination, {
          file: messages.map(msg => msg.media).filter(media => !!media),
          message: finalCaption,
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
    const task = metadata?.task as Task;
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
        
        // Check if media is just a web page preview (WebPage) or actual media
        const media = metadata.rawMessage.media;
        const isWebPage = media.className === 'MessageMediaWebPage' || (media._ && media._ === 'messageMediaWebPage');
        
        if (isWebPage) {
          console.log(`[Forwarder] Media is a WebPage preview, skipping sending as file and sending as text instead`);
        } else {
          const taskOptions = (metadata?.task?.options || task?.options) as any;
          let mediaCaption = metadata.originalText || content;
          
          if (taskOptions?.aiRewrite?.isEnabled && mediaCaption) {
            mediaCaption = await this.rewriteWithAI(
              (metadata?.task as Task) || task,
              mediaCaption,
              taskOptions.aiRewrite.provider,
              taskOptions.aiRewrite.model,
              taskOptions.aiRewrite.rules || []
            );
          }

          console.log(`[Forwarder] Executing client.sendMessage for media to ${target}. Link preview options:`, { isDisabled: taskOptions?.linkPreview === false });
          
          const mediaOptions: any = {
            file: media,
            message: mediaCaption,
            formattingEntities: metadata.entities
          };

          if (taskOptions?.linkPreview === false) {
            // Comprehensive link preview disabling for GramJS
            mediaOptions.linkPreview = { isDisabled: true };
            mediaOptions.linkPreviewOptions = { isDisabled: true };
            mediaOptions.noWebpage = true;
            mediaOptions.clearDraft = true;
            (mediaOptions as any).link_preview = { is_disabled: true };
            // Ensure no other flags override this
            mediaOptions.silent = mediaOptions.silent || false;
          }

          await client.sendMessage(target, mediaOptions);
          console.log(`[Forwarder] Media sent successfully to ${target}`);
          
          return {
            messageId: metadata.originalMessageId?.toString() || "media",
            success: true,
            details: "Media sent as new message successfully",
            timestamp: new Date(),
          };
        }
      }

      // Fallback to sending text if no media
      // Ensure destination is a valid numeric ID (standardized with -100)
      let target: any = destination;
      if (/^\d+$/.test(destination) && destination.length > 5 && !destination.startsWith("-")) {
        target = "-100" + destination;
        console.log(`[Forwarder] 🔄 Standardizing destination ${destination} -> ${target}`);
      } else if (destination.startsWith("-100") || destination.startsWith("-")) {
        target = destination;
      } else {
        // Handle cases where it might be a username (though resolveChannelId should have handled it)
        target = destination;
      }

      console.log(`[Forwarder] Sending text message to ${target}`);
      let entity;
      try {
        entity = await client.getEntity(target);
      } catch (e) {
        console.warn(`[Forwarder] getEntity failed for ${target}, trying to send directly:`, (e as Error).message);
        entity = target;
      }
      
      const messageOptions: any = {};
      const options = (metadata?.task?.options || task?.options) as any;

      console.log(`[Forwarder] Sending text message to ${target}. Link preview options:`, { isDisabled: options?.linkPreview === false });

      if (options?.linkPreview === false) {
        // Comprehensive link preview disabling for GramJS
        messageOptions.linkPreview = { isDisabled: true };
        messageOptions.linkPreviewOptions = { isDisabled: true };
        messageOptions.noWebpage = true;
        messageOptions.clearDraft = true;
        (messageOptions as any).link_preview = { is_disabled: true };
        // Ensure no other flags override this
        messageOptions.silent = messageOptions.silent || false;
      }

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
        const wordCount = textToAnalyze.split(/\s+/).filter((w: string) => w.length > 0).length;

        if (activeRules.length > 0 && textToAnalyze.trim().length > 0) {
        const rulesDescription = activeRules.map((r: any) => `- ${r.name}: ${r.instruction}`).join('\n');
        
        const prompt = `القواعد المطلوبة للتنفيذ:
${rulesDescription}

الرسالة المراد تحليلها: "${textToAnalyze}"

الوضع الحالي للفلاتر: ${aiFilters.mode === 'whitelist' ? 'سماح فقط بما يطابق القواعد (Whitelist)' : 'منع ما يطابق القواعد (Blacklist) - اسمح بكل شيء ما لم يخالف قاعدة'}

المطلوب منك:
1. تحليل الرسالة بناءً على القواعد المذكورة أعلاه "فقط".
2. الرد بتنسيق محدد جداً:
   - ابدأ بكلمة "ALLOW" إذا كانت الرسالة مسموح بها.
   - ابدأ بكلمة "BLOCK" إذا كانت الرسالة تخالف القواعد.
   - أضف فاصل "|" ثم اذكر اسم القاعدة التي تم استناد القرار إليها وسبب القرار باختصار.

مثال للرد في حال عدم وجود مخالفة: ALLOW | الرسالة لا تخالف أي قاعدة من القواعد المحددة.
مثال للرد في حال وجود مخالفة: BLOCK | [اسم القاعدة]: الرسالة تحتوي على محتوى سياسي محظور.`;

        try {
          const allConfigs = await storage.getAIConfigs();
          
          // Try to find the specific provider first, but fallback to any active provider if needed
          let aiConfig = allConfigs.find(c => c.provider === aiFilters.provider && c.isActive);
          
          if (!aiConfig) {
            aiConfig = allConfigs.find(c => c.isActive);
          }
          
          const apiKey = aiConfig?.apiKey || (aiConfig?.provider ? process.env[`${aiConfig.provider.toUpperCase()}_API_KEY`] : process.env[`${aiFilters.provider.toUpperCase()}_API_KEY`]);

          const currentTaskId = (metadata?.taskId as number) || 0;

          if (apiKey) {
            console.log(`[Forwarder] AI Request Start - Provider: ${aiConfig?.provider || aiFilters.provider}, Model: ${aiFilters.model}, Mode: ${aiFilters.mode}`);
            
            if (currentTaskId > 0) {
              await storage.createLog({
                taskId: currentTaskId,
                sourceChannel: "AI Filter",
                destinationChannel: "Processing",
                messageId: `ai_filter_${Date.now()}`,
                status: "info",
                details: `بدء فحص المحتوى بالذكاء الاصطناعي (وضع: ${aiFilters.mode})`,
              });
            }

            const startTime = Date.now();
            const response = await AIService.chat(aiConfig?.provider || aiFilters.provider, aiFilters.model, prompt, apiKey);
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
            
            if (decision.startsWith("BLOCK")) {
              const reason = decision.includes("|") ? decision.split("|")[1].trim() : "حظر بواسطة فلاتر الذكاء الاصطناعي";
              console.log(`[Forwarder] AI Decision: BLOCK, Reason: ${reason}`);
              
              if (currentTaskId > 0) {
                await storage.createLog({
                  taskId: currentTaskId,
                  sourceChannel: "AI Filter",
                  destinationChannel: "Blocked",
                  messageId: `ai_blocked_${Date.now()}`,
                  status: "skipped",
                  details: `تم الحظر: ${reason}`,
                });
              }

              return { allowed: false, reason: `حظر بواسطة الذكاء الاصطناعي: ${reason}` };
            }
            
            if (aiFilters.mode === 'whitelist' && !upperDecision.includes("ALLOW")) {
              const reason = "لم يطابق قواعد السماح (Whitelist)";
              console.log(`[Forwarder] AI Decision: BLOCK (${reason})`);
              
              if (currentTaskId > 0) {
                await storage.createLog({
                  taskId: currentTaskId,
                  sourceChannel: "AI Filter",
                  destinationChannel: "Blocked",
                  messageId: `ai_blocked_wl_${Date.now()}`,
                  status: "skipped",
                  details: `تم الحظر: ${reason}`,
                });
              }

              return { allowed: false, reason: `حظر بواسطة الذكاء الاصطناعي: ${reason}` };
            }
            
            const allowReason = decision.split('|')[1]?.trim() || "مطابق للقواعد";
            console.log(`[Forwarder] AI Decision: ALLOW`);
            
            if (currentTaskId > 0) {
              await storage.createLog({
                taskId: currentTaskId,
                sourceChannel: "AI Filter",
                destinationChannel: "Allowed",
                messageId: `ai_allowed_${Date.now()}`,
                status: "info",
                details: `تم السماح: ${allowReason}`,
              });
            }

          } else {
            const errorMsg = `API Key not found for provider: ${aiFilters.provider}`;
            console.error(`[Forwarder] ${errorMsg}`);
            if (currentTaskId > 0) {
              await storage.createLog({
                taskId: currentTaskId,
                sourceChannel: "AI Filter",
                destinationChannel: "Error",
                messageId: `ai_error_${Date.now()}`,
                status: "failed",
                details: `فشل فحص الفلتر: لم يتم العثور على مفتاح API لـ ${aiFilters.provider}`,
              });
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error(`[Forwarder] AI Filtering failed:`, error);
          const currentTaskId = (metadata?.taskId as number) || 0;
          if (currentTaskId > 0) {
            await storage.createLog({
              taskId: currentTaskId,
              sourceChannel: "AI Filter",
              destinationChannel: "Error",
              messageId: `ai_error_${Date.now()}`,
              status: "failed",
              details: `خطأ في فحص الفلتر: ${errorMsg}`,
            });
          }
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
