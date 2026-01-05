/**
 * معالج جدولة المهام
 * يدير تشغيل ووقف المهام والمراقبة
 */

import { storage } from "../storage";
import { forwarder } from "./forwarder";
import type { Task } from "@shared/schema";

export class TaskScheduler {
  private activeTasks: Map<number, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  /**
   * بدء جدولة المهام
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("[Scheduler] Starting task scheduler...");

    // تحميل جميع المهام النشطة
    const tasks = await storage.getTasks();
    const activeTasks = tasks.filter(t => t.isActive);

    for (const task of activeTasks) {
      this.scheduleTask(task);
    }
  }

  /**
   * إيقاف جدولة المهام
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    console.log("[Scheduler] Stopping task scheduler...");

    // إيقاف جميع المهام
    for (const entry of Array.from(this.activeTasks.entries())) {
      const [, timeout] = entry;
      clearInterval(timeout);
    }
    this.activeTasks.clear();
  }

  /**
   * جدولة مهمة واحدة
   */
  private scheduleTask(task: Task) {
    if (this.activeTasks.has(task.id)) {
      return; // المهمة مجدولة بالفعل
    }

    // سيتم تنفيذ المهمة عند المراقبة الفعلية للمصادر
    // للآن نسجل فقط
    console.log(`[Scheduler] Task #${task.id} (${task.name}) scheduled`);

    // يمكن إضافة timeout لكل مهمة للتحقق من النشاط
    const timeout = setInterval(() => {
      this.checkTaskStatus(task);
    }, 30000); // كل 30 ثانية

    this.activeTasks.set(task.id, timeout);
  }

  /**
   * إلغاء جدولة مهمة
   */
  unscheduleTask(taskId: number) {
    const timeout = this.activeTasks.get(taskId);
    if (timeout) {
      clearInterval(timeout);
      this.activeTasks.delete(taskId);
      console.log(`[Scheduler] Task #${taskId} unscheduled`);
    }
  }

  /**
   * التحقق من حالة المهمة
   */
  private async checkTaskStatus(task: Task) {
    try {
      const updatedTask = await storage.getTask(task.id);
      
      if (!updatedTask?.isActive && this.activeTasks.has(task.id)) {
        // المهمة توقفت
        this.unscheduleTask(task.id);
      }
    } catch (error) {
      console.error(`[Scheduler] Error checking task #${task.id}:`, error);
    }
  }

  /**
   * الحصول على حالة المهام النشطة
   */
  getActiveTasksCount(): number {
    return this.activeTasks.size;
  }

  /**
   * الحصول على تفاصيل المهام النشطة
   */
  getActiveTasks(): number[] {
    return Array.from(this.activeTasks.keys());
  }
}

// إنشاء instance واحد من المجدول
export const scheduler = new TaskScheduler();

// بدء المجدول عند بدء الخادم
let schedulerStarted = false;

export async function initializeScheduler() {
  if (!schedulerStarted) {
    await scheduler.start();
    schedulerStarted = true;
  }
}

// إيقاف المجدول عند إيقاف الخادم
process.on("SIGINT", () => {
  scheduler.stop();
  process.exit(0);
});
