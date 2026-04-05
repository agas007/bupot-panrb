import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api", // Path to the API folder
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Bupot PANRB API Documentation",
        version: "1.2.0",
        description: "Official API Documentation for the Bupot PANRB Management Suite.",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development Server",
        },
      ],
      components: {
        securitySchemes: {
          SimulatorUser: {
            type: "apiKey",
            in: "header",
            name: "x-simulated-user",
            description: "Custom header for simulation attribution in audit logs.",
          },
        },
      },
      security: [
        {
          SimulatorUser: [],
        },
      ],
    },
  });
  return spec;
};
