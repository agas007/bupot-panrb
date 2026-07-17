const authSecurity = [
  { SessionCookie: [] },
  { SimulatedUsername: [] },
];

const apiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Bupot PANRB API Documentation",
    version: "1.4.0",
    description: "Complete OpenAPI inventory for the Bupot PANRB backend routes.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development Server",
    },
  ],
  components: {
    securitySchemes: {
      SessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "bupot_session",
        description: "Session cookie issued by /api/auth/login.",
      },
      SimulatedUsername: {
        type: "apiKey",
        in: "header",
        name: "x-simulated-username",
        description: "Fallback identity header used by several simulation-aware routes.",
      },
      SimulatedUser: {
        type: "apiKey",
        in: "header",
        name: "x-simulated-user",
        description: "Audit attribution header used when the app writes activity logs.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
        },
        required: ["success"],
      },
      AuthSession: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
          username: { type: "string" },
          role: { type: "string", enum: ["ADMIN", "USER"] },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "username", "role"],
      },
      Colleague: {
        type: "object",
        properties: {
          id: { type: "number" },
          username: { type: "string" },
          name: { type: "string" },
          role: { type: "string", enum: ["ADMIN", "USER"] },
          createdAt: { type: "string", format: "date-time" },
          _count: {
            type: "object",
            properties: {
              records: { type: "number" },
            },
          },
        },
        required: ["id", "username", "name", "role", "createdAt"],
      },
      AuditLog: {
        type: "object",
        properties: {
          id: { type: "number" },
          userName: { type: "string" },
          action: { type: "string" },
          target: { type: "string" },
          type: { type: "string", enum: ["system", "user", "admin", "danger"] },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "userName", "action", "target", "type", "createdAt"],
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "number" },
          userId: { type: "number" },
          title: { type: "string" },
          message: { type: "string" },
          type: { type: "string" },
          isRead: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      RecordAssignee: {
        type: "object",
        properties: {
          id: { type: "number" },
          username: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      RecordBatch: {
        type: "object",
        properties: {
          id: { type: "number" },
          status: { type: "string", enum: ["PENDING", "DATA_ENTERED", "COMPLETED", "ISSUES"] },
          withholdingDate: { type: "string", format: "date-time", nullable: true },
          issueNotes: { type: "string", nullable: true },
          _count: {
            type: "object",
            properties: {
              withholdings: { type: "number" },
            },
          },
        },
      },
      RecordSummary: {
        type: "object",
        properties: {
          id: { type: "number" },
          uniqueKey: { type: "string", nullable: true },
          spmNumber: { type: "string" },
          spmDate: { type: "string", format: "date-time", nullable: true },
          accountCode: { type: "string" },
          deductionAmount: { type: "number" },
          sp2dNumber: { type: "string", nullable: true },
          sp2dDate: { type: "string", format: "date-time", nullable: true },
          description: { type: "string", nullable: true },
          recipient: { type: "string", nullable: true },
          totalValue: { type: "number", nullable: true },
          status: { type: "string" },
          assigneeId: { type: "number", nullable: true },
          completionDate: { type: "string", format: "date-time", nullable: true },
          docLink: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          importDate: { type: "string", format: "date-time", nullable: true },
          updatedAt: { type: "string", format: "date-time" },
          assignee: { $ref: "#/components/schemas/RecordAssignee" },
          pph21Batch: { $ref: "#/components/schemas/RecordBatch" },
        },
      },
      RecordCompact: {
        type: "object",
        properties: {
          id: { type: "number" },
          spmNumber: { type: "string" },
          sp2dNumber: { type: "string", nullable: true },
          sp2dDate: { type: "string", format: "date-time", nullable: true },
          description: { type: "string", nullable: true },
          recipient: { type: "string", nullable: true },
          accountCode: { type: "string" },
          deductionAmount: { type: "number" },
          totalValue: { type: "number", nullable: true },
          status: { type: "string" },
        },
      },
      DashboardStats: {
        type: "object",
        properties: {
          name: { type: "string" },
          total: { type: "number" },
          completed: { type: "number" },
          issues: { type: "number" },
          percentage: { type: "number" },
        },
      },
      MonthlyStats: {
        type: "object",
        properties: {
          key: { type: "string" },
          year: { type: "number" },
          month: { type: "number" },
          label: { type: "string" },
          total: { type: "number" },
          completed: { type: "number" },
          issues: { type: "number" },
          percentage: { type: "number" },
        },
      },
      ReconciliationTarget: {
        type: "object",
        properties: {
          accountCode: { type: "string" },
          coretaxAmount: { type: "number" },
        },
        required: ["accountCode", "coretaxAmount"],
      },
    },
  },
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in a user",
        description: "Validate credentials, create an activity log entry, and issue the session cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSession" },
              },
            },
          },
          401: {
            description: "Invalid username or password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          503: {
            description: "Database unavailable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out a user",
        description: "Write a logout audit log entry and clear the session cookie.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Logout success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          500: {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/session": {
      get: {
        tags: ["Auth"],
        summary: "Inspect current session",
        description: "Return the currently authenticated session user from the `bupot_session` cookie.",
        security: [{ SessionCookie: [] }],
        responses: {
          200: {
            description: "Current session user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSession" },
              },
            },
          },
          401: {
            description: "Session missing or expired",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/admin/system/cleanup": {
      post: {
        tags: ["Admin"],
        summary: "Purge old audit logs",
        description: "Delete audit log rows older than the requested retention period.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["days"],
                properties: {
                  days: { type: "number", minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Cleanup completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    count: { type: "number" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/colleagues": {
      get: {
        tags: ["Colleagues"],
        summary: "List colleagues",
        description: "Return all colleagues with record counts.",
        responses: {
          200: {
            description: "Colleague list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Colleague" },
                },
              },
            },
          },
          500: {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Colleagues"],
        summary: "Create a colleague",
        description: "Create a new colleague record. Only admins can call this route.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string" },
                  role: { type: "string", enum: ["ADMIN", "USER"] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Created colleague",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Colleague" },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Colleagues"],
        summary: "Update a colleague",
        description: "Update your own profile or, if you are admin, another colleague's profile.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string" },
                  role: { type: "string", enum: ["ADMIN", "USER"] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated colleague",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Colleague" },
              },
            },
          },
          401: {
            description: "Invalid session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Access denied",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Colleagues"],
        summary: "Delete a colleague",
        description: "Delete a colleague record. Self-deletion is blocked.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Delete success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dashboard metrics",
        description: "Return overall, per-colleague, and monthly completion metrics.",
        parameters: [
          { name: "year", in: "query", required: false, schema: { type: "string" } },
          { name: "month", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Dashboard metrics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "number" },
                    completed: { type: "number" },
                    issues: { type: "number" },
                    unassigned: { type: "number" },
                    colleagueStats: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DashboardStats" },
                    },
                    monthlyStats: {
                      type: "array",
                      items: { $ref: "#/components/schemas/MonthlyStats" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/import": {
      post: {
        tags: ["Import"],
        summary: "Bulk import records from Excel",
        description: "Import or preview merged potongan/SPP data from two uploaded files.",
        security: authSecurity,
        parameters: [
          { name: "preview", in: "query", required: false, schema: { type: "string", enum: ["true", "false"] } },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["potongan", "spp"],
                properties: {
                  potongan: { type: "string", format: "binary" },
                  spp: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Preview or import result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    count: { type: "number" },
                    preview: {
                      type: "array",
                      items: { type: "object", additionalProperties: true },
                    },
                    isPartial: { type: "boolean" },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/logs": {
      get: {
        tags: ["Logs"],
        summary: "Fetch activity logs",
        description: "Retrieve the latest 200 audit log entries.",
        responses: {
          200: {
            description: "Audit log list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AuditLog" },
                },
              },
            },
          },
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List current user notifications",
        description: "Return the latest notifications for the current authenticated user.",
        security: authSecurity,
        responses: {
          200: {
            description: "Notification list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Notification" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Notifications"],
        summary: "Mark notifications as read",
        description: "Mark a single notification or all notifications as read for the current user.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  all: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Update success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pph21": {
      get: {
        tags: ["PPh21"],
        summary: "List or inspect PPh 21 records",
        description: "Return a paginated list of PPh 21 records, or a single record when `recordId` is provided.",
        security: authSecurity,
        parameters: [
          { name: "recordId", in: "query", required: false, schema: { type: "number" } },
        ],
        responses: {
          200: {
            description: "Record list or record detail",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                    {
                      type: "object",
                      additionalProperties: true,
                    },
                  ],
                },
              },
            },
          },
          403: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Record not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["PPh21"],
        summary: "Save PPh 21 details",
        description: "Persist withholding lines for a PPh 21 record and calculate balance against the expected deduction.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recordId", "withholdingDate", "lines"],
                properties: {
                  recordId: { type: "number" },
                  withholdingDate: { type: "string" },
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["name", "taxObjectCode", "gross", "deemed", "rate", "calculatedTax"],
                      properties: {
                        nik: { type: "string", nullable: true },
                        name: { type: "string" },
                        taxObjectCode: { type: "string" },
                        gross: { type: "number" },
                        deemed: { type: "number" },
                        rate: { type: "number" },
                        calculatedTax: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Saved batch and balance summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    batch: { type: "object", additionalProperties: true },
                    totalTax: { type: "number" },
                    expectedTax: { type: "number" },
                    isBalanced: { type: "boolean" },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Authentication required or access denied",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Record not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["PPh21"],
        summary: "Update PPh 21 batch status",
        description: "Update a saved PPh 21 batch status to DATA_ENTERED or ISSUES.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recordId", "status"],
                properties: {
                  recordId: { type: "number" },
                  status: { type: "string", enum: ["DATA_ENTERED", "ISSUES"] },
                  issueNotes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated batch",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Authentication required or access denied",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Batch not available",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pph21/export": {
      post: {
        tags: ["PPh21"],
        summary: "Export PPh 21 XML",
        description: "Generate an XML file for selected SP2D records and mark exported batches as completed.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["recordIds"],
                properties: {
                  recordIds: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "XML export file",
            content: {
              "application/xml": {
                schema: { type: "string" },
              },
            },
            headers: {
              "Content-Disposition": {
                schema: { type: "string" },
              },
              "X-Export-Filename": {
                schema: { type: "string" },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Authentication required or access denied",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pph21/import": {
      post: {
        tags: ["PPh21"],
        summary: "Import PPh 21 XML",
        description: "Parse a PPh 21 XML file, reconcile the documents, and optionally import eligible batches.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["xml"],
                properties: {
                  xml: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Import summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fileName: { type: "string" },
                    totalRows: { type: "number" },
                    totalDocuments: { type: "number" },
                    importedCount: { type: "number" },
                    matchCount: { type: "number" },
                    mismatchCount: { type: "number" },
                    notFoundCount: { type: "number" },
                    groups: {
                      type: "array",
                      items: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pph21/import/payroll": {
      post: {
        tags: ["PPh21"],
        summary: "Inspect payroll XML",
        description: "Parse a payroll XML file and return summary metrics without writing to the database.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["xml"],
                properties: {
                  xml: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payroll summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fileName: { type: "string" },
                    totalRows: { type: "number" },
                    uniqueRecipients: { type: "number" },
                    totalGross: { type: "number" },
                    totalTax: { type: "number" },
                    taxPeriodMonth: { type: "number", nullable: true },
                    taxPeriodYear: { type: "number", nullable: true },
                    withholdingDate: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pph21/recipients": {
      get: {
        tags: ["PPh21"],
        summary: "List PPh 21 recipients",
        description: "Return recipient master data with withholding history and monthly summaries.",
        security: authSecurity,
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Recipient list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
          403: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["PPh21"],
        summary: "Update a PPh 21 recipient",
        description: "Update recipient master data. Admin only.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                  nik: { type: "string" },
                  defaultTaxObjectCode: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated recipient",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          404: {
            description: "Recipient not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/records": {
      get: {
        tags: ["Records"],
        summary: "List SPM records",
        description: "Return paginated SPM records with filter and sorting support.",
        parameters: [
          { name: "assigneeId", in: "query", required: false, schema: { type: "string" } },
          { name: "status", in: "query", required: false, schema: { type: "string" } },
          { name: "pph21Process", in: "query", required: false, schema: { type: "string" } },
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          { name: "accountCode", in: "query", required: false, schema: { type: "string" } },
          { name: "startDate", in: "query", required: false, schema: { type: "string" } },
          { name: "endDate", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "number" } },
          { name: "pageSize", in: "query", required: false, schema: { type: "string" } },
          { name: "sortKey", in: "query", required: false, schema: { type: "string" } },
          { name: "sortDirection", in: "query", required: false, schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "compact", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Paginated record payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        oneOf: [
                          { $ref: "#/components/schemas/RecordCompact" },
                          { $ref: "#/components/schemas/RecordSummary" },
                        ],
                      },
                    },
                    total: { type: "number" },
                    page: { type: "number" },
                    pageSize: { type: "number" },
                  },
                },
              },
            },
          },
          500: {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Records"],
        summary: "Update one or many records",
        description: "Update record status, assignment, doc link, notes, or apply a bulk update.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  ids: {
                    type: "array",
                    items: { type: "number" },
                  },
                  status: { type: "string", enum: ["PENDING", "COMPLETED", "ISSUES"] },
                  docLink: { type: "string" },
                  notes: { type: "string" },
                  assigneeId: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated record or bulk count",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        count: { type: "number" },
                      },
                    },
                    { $ref: "#/components/schemas/RecordSummary" },
                  ],
                },
              },
            },
          },
          403: {
            description: "Authentication required for assignment",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          500: {
            description: "Unexpected server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/reconciliation": {
      get: {
        tags: ["Reconciliation"],
        summary: "Load reconciliation data",
        description: "Return the saved reconciliation period, computed summary, and selectable period history.",
        security: authSecurity,
        parameters: [
          { name: "year", in: "query", required: false, schema: { type: "number" } },
          { name: "month", in: "query", required: false, schema: { type: "number" } },
        ],
        responses: {
          200: {
            description: "Reconciliation payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    selection: {
                      type: "object",
                      properties: {
                        year: { type: "number" },
                        month: { type: "number" },
                      },
                    },
                    period: { type: "object", additionalProperties: true, nullable: true },
                    summary: { type: "object", additionalProperties: true },
                    totals: { type: "object", additionalProperties: true },
                    savedPeriods: {
                      type: "array",
                      items: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
          403: {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Reconciliation"],
        summary: "Save reconciliation period",
        description: "Create or update a reconciliation period with target account amounts.",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["year", "month"],
                properties: {
                  year: { type: "number" },
                  month: { type: "number" },
                  status: { type: "string", enum: ["DRAFT", "FINAL"] },
                  title: { type: "string" },
                  notes: { type: "string" },
                  targets: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ReconciliationTarget" },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Saved reconciliation payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          403: {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          400: {
            description: "Invalid period",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const getApiDocs = async () => apiSpec;
