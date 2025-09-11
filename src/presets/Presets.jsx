export const GATEWAY_PRESETS = {
  paypro: {
    name: "PayPro",
    fields: {
      PAYPRO_CLIENT_SECRET: "",
      PAYPRO_MERCHANT_ID: "",
      PAYPRO_CLIENT_ID: "",
    },
    logo: "https://i.ibb.co/d4Y2vh9Y/cropped-Logo-Blue-1.png",
  },
  payfast: {
    name: "PayFast",
    fields: {
      SECURED_KEY: "",
      CURRENCY_CODE: "",
      CHECKOUT_URL:
        "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/PostTransaction",
      TOKEN_API_URL:
        "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken",
      MERCHANT_ID: "",
    },
    logo: "https://i.ibb.co/g4FCmV4/Pay-Fast-Logo.png",
  },
  stripe: {
    name: "Stripe",
    fields: {
      STRIPE_PUBLISHABLE_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      STRIPE_SECRET_KEY: "",
    },
    logo: "https://i.ibb.co/JWcxf7kh/Stripe-Logo-revised-2016-svg.png",
  },
};

export const SERVER_PRESETS = {
  smtp: {
    name: "Global SMTP",
    fields: {
      HOST: {
        type: "text",
        value: "",
        label: "SMTP server hostname (e.g. smtp.gmail.com)"
      },
      PORT: {
        type: "number", 
        value: "",
        label: "SMTP port (e.g. 587 for TLS, 465 for SSL)"
      },
      FROM_EMAIL: {
        type: "text",
        value: "",
        label: "Sender email address"
      },
      SECURE: {
        type: "boolean",
        value: "",
        label: "Use TLS/SSL"
      },
      USERNAME: {
        type: "text",
        value: "",
        label: "SMTP authentication username"
      },
      PASSWORD: {
        type: "text",
        value: "",
        label: "SMTP authentication password"
      },
      TLS: {
        type: "boolean",
        value: "",
        label: "Enable TLS"
      },
    },
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTKN3yK3hFEVJPP5cGaLUgxPyw5S5sdwqBuSg&s",
  },
  elasticMail: {
    name: "Elastic Email API",
    fields: {
      API_KEY: {
        type: "text",
        value: "",
        label: "Elastic Email API key"
      },
      FROM_EMAIL: {
        type: "text",
        value: "",
        label: "Default Email From"
      },
      FROM_NAME: {
        type: "text",
        value: "",
        label: "Sender name"
      },
      TRACKING: {
        type: "boolean",
        value: true,
        label: "Enable email tracking"
      },
      IS_TRANSACTIONAL: {
        type: "boolean",
        value: true,
        label: "Is the email transactional"
      }
    },
    logo: "https://www.sender.net/wp-content/uploads/2025/07/Elastic-email.png",
  },
};

export const formConfigurations = {
  website: {
    name: "Website",
    hasLogo: true,
    steps: [
      { id: 1, title: "Basic Website Configuration" },
      { id: 2, title: "Portal Configuration" },
      { id: 3, title: "Gateway Configuration" },
      { id: 4, title: "Template Configuration" },
      { id: 5, title: "Courses Configuration" },
      { id: 6, title: "Website Information Review & Submit" },
    ],
    initialData: {
      name: "",
      logo: "", // This will store the logo URL
      sendWebhookUrl: "",
      receiveWebhookUrl: "",
      isActive: true,
      accessablePortal: [], // Will store IDs of selected portals
      accessableGateway: [], // Will store IDs of selected gateways
      templates: [], // Will store IDs of selected templates
      courses: [],
    },
  },
  portal: {
    name: "Portal",
    hasLogo: true,
    steps: [
      { id: 1, title: "Portal Details" },
      { id: 2, title: "Configuration & Review" },
    ],
    initialData: {
      name: "",
      description: "",
      isActive: true,
      associatedWebsites: [], // Stores IDs of selected websites
      keys: {}, // Stores custom key-value pairs
      logo: "", // URL for the portal's logo
    },
  },
  gateway: {
    name: "Gateway",
    hasLogo: true,
    steps: [
      { id: 1, title: "Select Gateway Type" },
      { id: 2, title: "Basic Gateway Configuration" },
      { id: 3, title: "API Configuration" },
      { id: 4, title: "Select Associated Websites" },
      { id: 5, title: "Gateway Information & Submit Details" },
    ],
    initialData: {
      name: "",
      description: "",
      isActive: true,
      associatedWebsites: [],
      keys: {},
      logo: "",
      preset: null, // Stores the selected preset key (e.g., 'paypro', 'stripe')
      miniId: "", // Unique 3-digit ID for the gateway
    },
  },
  template: {
    name: "Template",
    hasLogo: false, // Explicitly false as requested by the user
    steps: [
      { id: 1, title: "Template Details" },
      { id: 2, title: "Content & Review" },
    ],
    initialData: {
      name: "",
      subject: "",
      html: "",
      usedBy: null, // State for the associated website
      isActive: true,
    },
  },
};
