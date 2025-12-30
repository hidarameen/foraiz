import { z } from 'zod';
import { insertTaskSchema, insertSessionSchema, tasks, sessions, logs } from './schema';

// Shared Error Schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // === SESSIONS (Telegram Accounts) ===
  sessions: {
    list: {
      method: 'GET' as const,
      path: '/api/sessions',
      responses: {
        200: z.array(z.custom<typeof sessions.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sessions',
      input: insertSessionSchema,
      responses: {
        201: z.custom<typeof sessions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/sessions/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    // Special route to generate QR code or handle login flow
    login: {
      method: 'POST' as const,
      path: '/api/sessions/login',
      input: z.object({
        phoneNumber: z.string(),
        code: z.string().optional(),
        password: z.string().optional(),
        phoneCodeHash: z.string().optional(),
      }),
      responses: {
        200: z.object({
          status: z.enum(['code_sent', 'password_required', 'logged_in']),
          phoneCodeHash: z.string().optional(),
          sessionString: z.string().optional(),
        }),
        400: z.object({ message: z.string() }),
      }
    }
  },

  // === TASKS (Forwarding Rules) ===
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tasks/:id',
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks',
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tasks/:id',
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tasks/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    toggle: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id/toggle',
      input: z.object({ isActive: z.boolean() }),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },

  // === LOGS ===
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      input: z.object({
        taskId: z.string().optional(), // Query param
        limit: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>()),
      },
    },
  },
  
  // === SYSTEM STATS ===
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          activeTasks: z.number(),
          totalForwarded: z.number(),
          uptime: z.number(),
          workerStatus: z.enum(['running', 'stopped', 'error']),
        })
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
