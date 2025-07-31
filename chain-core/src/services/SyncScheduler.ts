import { DatabaseManager } from '../database/manager';
import { RedisManager } from './redis';

interface SyncTask {
  id: string;
  type: 'products' | 'inventory' | 'transactions' | 'employees' | 'branches';
  branchId?: string;
  scheduleType: 'interval' | 'cron' | 'manual';
  intervalMinutes?: number;
  cronExpression?: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'failed' | 'completed';
  priority: number;
}

interface SyncResult {
  taskId: string;
  success: boolean;
  recordsProcessed: number;
  errorMessage?: string;
  duration: number;
  completedAt: Date;
}

export class SyncScheduler {
  private static instance: SyncScheduler;
  private tasks: Map<string, SyncTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private redisManager: RedisManager;

  private constructor() {
    this.redisManager = RedisManager.getInstance();
    this.setupDefaultTasks();
  }

  public static getInstance(): SyncScheduler {
    if (!SyncScheduler.instance) {
      SyncScheduler.instance = new SyncScheduler();
    }
    return SyncScheduler.instance;
  }

  private setupDefaultTasks(): void {
    // Default sync tasks
    const defaultTasks: Omit<SyncTask, 'id'>[] = [
      {
        type: 'products',
        scheduleType: 'interval',
        intervalMinutes: 30,
        isActive: true,
        status: 'idle',
        priority: 1
      },
      {
        type: 'inventory',
        scheduleType: 'interval',
        intervalMinutes: 15,
        isActive: true,
        status: 'idle',
        priority: 2
      },
      {
        type: 'transactions',
        scheduleType: 'interval',  
        intervalMinutes: 5,
        isActive: true,
        status: 'idle',
        priority: 3
      },
      {
        type: 'employees',
        scheduleType: 'interval',
        intervalMinutes: 60,
        isActive: true,
        status: 'idle',
        priority: 4
      }
    ];

    defaultTasks.forEach(task => {
      const taskId = this.generateTaskId(task.type, task.branchId);
      this.tasks.set(taskId, {
        id: taskId,
        ...task
      });
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('SyncScheduler is already running');
      return;
    }

    console.log('Starting SyncScheduler...');
    this.isRunning = true;

    // Load tasks from database
    await this.loadTasksFromDatabase();

    // Schedule all active tasks
    for (const task of this.tasks.values()) {
      if (task.isActive) {
        await this.scheduleTask(task);
      }
    }

    console.log(`SyncScheduler started with ${this.tasks.size} tasks`);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping SyncScheduler...');
    this.isRunning = false;

    // Clear all intervals
    for (const [taskId, interval] of this.intervals.entries()) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    console.log('SyncScheduler stopped');
  }

  private async loadTasksFromDatabase(): Promise<void> {
    try {
      const result = await DatabaseManager.query(`
        SELECT id, task_type, branch_id, schedule_type, interval_minutes, 
               cron_expression, is_active, last_run, next_run, status, priority
        FROM sync_tasks
        WHERE is_active = true
      `);

      for (const row of result.rows) {
        const task: SyncTask = {
          id: row.id,
          type: row.task_type,
          branchId: row.branch_id,
          scheduleType: row.schedule_type,
          intervalMinutes: row.interval_minutes,
          cronExpression: row.cron_expression,
          isActive: row.is_active,
          lastRun: row.last_run,
          nextRun: row.next_run,
          status: row.status,
          priority: row.priority
        };

        this.tasks.set(task.id, task);
      }
    } catch (error) {
      console.error('Failed to load sync tasks from database:', error);
      // Continue with default tasks if database loading fails
    }
  }

  private async scheduleTask(task: SyncTask): Promise<void> {
    if (task.scheduleType === 'interval' && task.intervalMinutes) {
      const intervalMs = task.intervalMinutes * 60 * 1000;
      
      // Run immediately if never run before or overdue
      const shouldRunImmediately = !task.lastRun || 
        (task.nextRun && new Date() > task.nextRun);

      if (shouldRunImmediately) {
        // Run with small delay to avoid blocking
        setTimeout(() => this.executeTask(task), 1000);
      }

      // Schedule recurring execution
      const interval = setInterval(async () => {
        await this.executeTask(task);
      }, intervalMs);

      this.intervals.set(task.id, interval);
      
      // Update next run time
      task.nextRun = new Date(Date.now() + intervalMs);
      await this.updateTaskInDatabase(task);
    }
    // TODO: Add cron scheduling support
  }

  private async executeTask(task: SyncTask): Promise<SyncResult> {
    if (task.status === 'running') {
      console.log(`Task ${task.id} is already running, skipping...`);
      return {
        taskId: task.id,
        success: false,
        recordsProcessed: 0,
        errorMessage: 'Task already running',
        duration: 0,
        completedAt: new Date()
      };
    }

    const startTime = Date.now();
    console.log(`Executing sync task: ${task.type} (${task.id})`);

    // Update task status
    task.status = 'running';
    task.lastRun = new Date();
    await this.updateTaskInDatabase(task);

    try {
      let result: SyncResult;

      switch (task.type) {
        case 'products':
          result = await this.syncProducts(task);
          break;
        case 'inventory':
          result = await this.syncInventory(task);
          break;
        case 'transactions':
          result = await this.syncTransactions(task);
          break;
        case 'employees':
          result = await this.syncEmployees(task);
          break;
        case 'branches':
          result = await this.syncBranches(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      result.duration = Date.now() - startTime;
      result.completedAt = new Date();

      // Cache the result
      await this.redisManager.set(
        `sync_result:${task.id}`,
        result,
        3600 // Cache for 1 hour
      );

      // Log successful sync
      await this.logSyncResult(result);
      
      console.log(`Sync task completed: ${task.type} (${result.recordsProcessed} records, ${result.duration}ms)`);
      
      return result;

    } catch (error) {
      task.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const result: SyncResult = {
        taskId: task.id,
        success: false,
        recordsProcessed: 0,
        errorMessage,
        duration: Date.now() - startTime,
        completedAt: new Date()
      };

      // Log failed sync
      await this.logSyncResult(result);
      
      console.error(`Sync task failed: ${task.type} - ${errorMessage}`);
      
      return result;
    } finally {
      // Update task in database
      await this.updateTaskInDatabase(task);
    }
  }

  private async syncProducts(task: SyncTask): Promise<SyncResult> {
    // Placeholder implementation - sync products with external system
    const recordsProcessed = Math.floor(Math.random() * 50) + 1;
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    
    return {
      taskId: task.id,
      success: true,
      recordsProcessed,
      duration: 0, // Will be set by caller
      completedAt: new Date()
    };
  }

  private async syncInventory(task: SyncTask): Promise<SyncResult> {
    // Placeholder implementation - sync inventory levels
    let recordsProcessed = 0;

    try {
      // Get inventory items that need syncing
      let query = `
        SELECT id, product_id, branch_id, quantity, last_updated
        FROM inventory
        WHERE last_updated < NOW() - INTERVAL '1 hour'
      `;
      
      const params: any[] = [];
      if (task.branchId) {
        query += ` AND branch_id = $1`;
        params.push(task.branchId);
      }

      const result = await DatabaseManager.query(query, params);
      recordsProcessed = result.rows.length;

      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      throw new Error(`Inventory sync failed: ${error}`);
    }

    return {
      taskId: task.id,
      success: true,
      recordsProcessed,
      duration: 0,
      completedAt: new Date()
    };
  }

  private async syncTransactions(task: SyncTask): Promise<SyncResult> {
    // Placeholder implementation - sync recent transactions
    let recordsProcessed = 0;

    try {
      // Get recent transactions that need syncing
      let query = `
        SELECT id, branch_id, total_amount, created_at
        FROM transactions
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        AND status = 'completed'
      `;
      
      const params: any[] = [];
      if (task.branchId) {
        query += ` AND branch_id = $1`;
        params.push(task.branchId);
      }

      const result = await DatabaseManager.query(query, params);
      recordsProcessed = result.rows.length;

      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      throw new Error(`Transaction sync failed: ${error}`);
    }

    return {
      taskId: task.id,
      success: true,
      recordsProcessed,
      duration: 0,
      completedAt: new Date()
    };
  }

  private async syncEmployees(task: SyncTask): Promise<SyncResult> {
    // Placeholder implementation - sync employee data
    const recordsProcessed = Math.floor(Math.random() * 10) + 1;
    
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate work
    
    return {
      taskId: task.id,
      success: true,
      recordsProcessed,
      duration: 0,
      completedAt: new Date()
    };
  }

  private async syncBranches(task: SyncTask): Promise<SyncResult> {
    // Placeholder implementation - sync branch data
    const recordsProcessed = Math.floor(Math.random() * 5) + 1;
    
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate work
    
    return {
      taskId: task.id,
      success: true,
      recordsProcessed,
      duration: 0,
      completedAt: new Date()
    };
  }

  private async updateTaskInDatabase(task: SyncTask): Promise<void> {
    try {
      await DatabaseManager.query(`
        UPDATE sync_tasks 
        SET last_run = $1, next_run = $2, status = $3
        WHERE id = $4
      `, [task.lastRun, task.nextRun, task.status, task.id]);
    } catch (error) {
      console.error('Failed to update task in database:', error);
    }
  }

  private async logSyncResult(result: SyncResult): Promise<void> {
    try {
      await DatabaseManager.query(`
        INSERT INTO sync_history (
          task_id, integration_type, entity_type, sync_status, 
          records_synced, error_message, started_at, completed_at
        ) VALUES (
          $1, 'scheduler', (SELECT task_type FROM sync_tasks WHERE id = $1), $2, 
          $3, $4, $5, $6
        )
      `, [
        result.taskId,
        result.success ? 'completed' : 'failed',
        result.recordsProcessed,
        result.errorMessage,
        new Date(result.completedAt.getTime() - result.duration),
        result.completedAt
      ]);
    } catch (error) {
      console.error('Failed to log sync result:', error);
    }
  }

  private generateTaskId(type: string, branchId?: string): string {
    return `${type}_${branchId || 'all'}_${Date.now()}`;
  }

  // Public API methods

  public async addTask(task: Omit<SyncTask, 'id' | 'status'>): Promise<string> {
    const taskId = this.generateTaskId(task.type, task.branchId);
    const newTask: SyncTask = {
      id: taskId,
      status: 'idle',
      ...task
    };

    this.tasks.set(taskId, newTask);

    // Save to database
    await DatabaseManager.query(`
      INSERT INTO sync_tasks (
        id, task_type, branch_id, schedule_type, interval_minutes,
        cron_expression, is_active, status, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      newTask.id, newTask.type, newTask.branchId, newTask.scheduleType,
      newTask.intervalMinutes, newTask.cronExpression, newTask.isActive,
      newTask.status, newTask.priority
    ]);

    // Schedule if active
    if (newTask.isActive && this.isRunning) {
      await this.scheduleTask(newTask);
    }

    return taskId;
  }

  public async removeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Clear interval if exists
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    // Remove from memory
    this.tasks.delete(taskId);

    // Remove from database
    await DatabaseManager.query('DELETE FROM sync_tasks WHERE id = $1', [taskId]);

    return true;
  }

  public async runTaskNow(taskId: string): Promise<SyncResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return await this.executeTask(task);
  }

  public getTasks(): SyncTask[] {
    return Array.from(this.tasks.values());
  }

  public getTask(taskId: string): SyncTask | undefined {
    return this.tasks.get(taskId);
  }

  public async getTaskHistory(taskId: string, limit: number = 10): Promise<any[]> {
    const result = await DatabaseManager.query(`
      SELECT * FROM sync_history 
      WHERE task_id = $1 
      ORDER BY completed_at DESC 
      LIMIT $2
    `, [taskId, limit]);

    return result.rows;
  }

  public getStatus(): {
    isRunning: boolean;
    totalTasks: number;
    activeTasks: number;
    runningTasks: number;
    nextRunTimes: { taskId: string; nextRun: Date | undefined }[];
  } {
    const activeTasks = Array.from(this.tasks.values()).filter(t => t.isActive);
    const runningTasks = activeTasks.filter(t => t.status === 'running');
    const nextRunTimes = activeTasks
      .filter(t => t.nextRun)
      .map(t => ({ taskId: t.id, nextRun: t.nextRun }))
      .sort((a, b) => (a.nextRun!.getTime() - b.nextRun!.getTime()));

    return {
      isRunning: this.isRunning,
      totalTasks: this.tasks.size,
      activeTasks: activeTasks.length,
      runningTasks: runningTasks.length,
      nextRunTimes
    };
  }
}
