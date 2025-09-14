"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  FiUpload,
  FiSearch,
  FiRefreshCw,
  FiDownload,
  FiFilter,
  FiChevronDown,
  FiChevronRight,
  FiFile,
  FiDatabase,
  FiPieChart,
  FiBarChart,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiSend,
  FiPlay,
  FiPause,
  FiSettings,
  FiInfo,
  FiHelpCircle,
  FiClock,
  FiUsers,
  FiToggleLeft,
  FiToggleRight,
  FiZap,
  FiActivity,
  FiEye,
  FiTrash2,
  FiSave,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import {
  Checkbox,
  inputStyles,
  labelStyles,
  MiniCard,
  ToggleLiver,
} from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import SidebarWrapper from "@/components/SidebarWrapper";

// IndexedDB Storage Manager
class StorageManager {
  constructor() {
    this.dbName = 'CSVAnalyzerDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create stores
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('responses')) {
          const responseStore = db.createObjectStore('responses', { keyPath: 'id' });
          responseStore.createIndex('sessionId', 'sessionId', { unique: false });
          responseStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveSession(sessionData) {
    const transaction = this.db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    return store.put(sessionData);
  }

  async getSession(sessionId) {
    const transaction = this.db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveResponse(responseData) {
    const transaction = this.db.transaction(['responses'], 'readwrite');
    const store = transaction.objectStore('responses');
    return store.put(responseData);
  }

  async getResponses(sessionId) {
    const transaction = this.db.transaction(['responses'], 'readonly');
    const store = transaction.objectStore('responses');
    const index = store.index('sessionId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(sessionId) {
    const transaction = this.db.transaction(['sessions', 'responses'], 'readwrite');
    const sessionStore = transaction.objectStore('sessions');
    const responseStore = transaction.objectStore('responses');
    
    await sessionStore.delete(sessionId);
    
    const index = responseStore.index('sessionId');
    const responses = await new Promise((resolve, reject) => {
      const request = index.getAll(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    for (const response of responses) {
      await responseStore.delete(response.id);
    }
  }
}

// Tooltip component for helpful notes
const InfoTooltip = ({ content, position = "top" }) => (
  <div className="relative inline-flex group">
    <FiHelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
    <div
      className={`absolute z-50 invisible group-hover:visible bg-zinc-900 text-white text-xs rounded py-1 px-2 max-w-xs ${
        position === "top"
          ? "bottom-full mb-1 left-1/2 -translate-x-1/2"
          : position === "right"
          ? "left-full ml-1 top-1/2 -translate-y-1/2"
          : "top-full mt-1 left-1/2 -translate-x-1/2"
      }`}
    >
      {content}
      <div
        className={`absolute w-2 h-2 bg-zinc-900 rotate-45 ${
          position === "top"
            ? "top-full left-1/2 -translate-x-1/2 -mt-1"
            : position === "right"
            ? "right-full top-1/2 -translate-y-1/2 -ml-1"
            : "bottom-full left-1/2 -translate-x-1/2 -mb-1"
        }`}
      />
    </div>
  </div>
);

// Data type detection
const detectDataType = (values) => {
  if (!values.length) return "empty";

  const nonEmpty = values.filter((v) => v && String(v).trim());
  if (!nonEmpty.length) return "empty";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const numberPattern = /^-?\d*\.?\d+$/;
  const phonePattern = /^[\+]?[\d\s\-\(\)]{10,}$/;
  const datePattern =
    /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}|^\d{2}-\d{2}-\d{4}/;

  let emails = 0,
    numbers = 0,
    phones = 0,
    dates = 0;

  nonEmpty.forEach((val) => {
    const str = String(val).trim();
    if (emailPattern.test(str)) emails++;
    else if (numberPattern.test(str)) numbers++;
    else if (phonePattern.test(str)) phones++;
    else if (datePattern.test(str)) dates++;
  });

  const total = nonEmpty.length;
  if (emails / total > 0.8) return "email";
  if (numbers / total > 0.8) return "number";
  if (phones / total > 0.8) return "phone";
  if (dates / total > 0.8) return "date";

  return "text";
};

// Schema detection
const detectSchemas = (data) => {
  const schemas = new Map();

  data.forEach((row, index) => {
    const fields = Object.keys(row).filter(
      (key) => row[key] && String(row[key]).trim()
    );
    const schemaKey = fields.sort().join(",");

    if (!schemas.has(schemaKey)) {
      schemas.set(schemaKey, {
        fields: fields.sort(),
        count: 0,
        rows: [],
        examples: {},
      });
    }

    const schema = schemas.get(schemaKey);
    schema.count++;
    schema.rows.push(index);

    // Store examples for each field
    fields.forEach((field) => {
      if (!schema.examples[field]) schema.examples[field] = [];
      if (schema.examples[field].length < 3) {
        schema.examples[field].push(row[field]);
      }
    });
  });

  return Array.from(schemas.entries()).map(([key, value], index) => ({
    id: index + 1,
    key,
    ...value,
    percentage: ((value.count / data.length) * 100).toFixed(1),
  }));
};

// Field analysis
const analyzeFields = (data) => {
  if (!data.length) return [];

  const allFields = new Set();
  data.forEach((row) => {
    Object.keys(row).forEach((field) => allFields.add(field));
  });

  return Array.from(allFields)
    .map((field) => {
      const values = data
        .map((row) => row[field])
        .filter((v) => v !== undefined);
      const nonEmptyValues = values.filter((v) => v && String(v).trim());
      const uniqueValues = new Set(nonEmptyValues);

      return {
        name: field,
        totalRecords: values.length,
        filledRecords: nonEmptyValues.length,
        emptyRecords: values.length - nonEmptyValues.length,
        completeness: values.length
          ? ((nonEmptyValues.length / values.length) * 100).toFixed(1)
          : 0,
        uniqueValues: uniqueValues.size,
        dataType: detectDataType(nonEmptyValues),
        samples: Array.from(uniqueValues).slice(0, 5),
        avgLength: nonEmptyValues.length
          ? (
              nonEmptyValues.reduce((sum, v) => sum + String(v).length, 0) /
              nonEmptyValues.length
            ).toFixed(1)
          : 0,
      };
    })
    .sort((a, b) => b.filledRecords - a.filledRecords);
};

export default function CSVAnalyzer() {
  // Storage manager
  const [storageManager] = useState(() => new StorageManager());
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // File upload state
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Analysis results
  const [fields, setFields] = useState([]);
  const [schemas, setSchemas] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [fieldFilter, setFieldFilter] = useState("all");
  const [dataTypeFilter, setDataTypeFilter] = useState("all");
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());

  // API Integration state
  const [apiConfig, setApiConfig] = useState({
    url: "",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    batchSize: 20,
    interval: 5000,
    enabled: false,
    totalSent: 0,
    currentBatch: 0,
    payloadFormat: "array", // "array" or "single"
  });
  const [selectedApiFields, setSelectedApiFields] = useState(new Set());
  const [apiHeaders, setApiHeaders] = useState([
    { key: "Content-Type", value: "application/json" },
  ]);
  const [isApiRunning, setIsApiRunning] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [sendProgress, setSendProgress] = useState({
    sent: 0,
    total: 0,
    errors: 0,
  });

  // Response history state
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [responseFilter, setResponseFilter] = useState("all"); // all, success, error

  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);

  // Initialize storage
  useEffect(() => {
    storageManager.init().catch(console.error);
  }, [storageManager]);

  // Save session data periodically
  useEffect(() => {
    if (csvData.length > 0) {
      const sessionData = {
        id: sessionId,
        timestamp: new Date().toISOString(),
        fileName: file?.name,
        csvData,
        fields,
        schemas,
        apiConfig,
        selectedApiFields: Array.from(selectedApiFields),
        sendProgress,
        isApiRunning,
      };

      storageManager.saveSession(sessionData).catch(console.error);
    }
  }, [csvData, fields, schemas, apiConfig, selectedApiFields, sendProgress, isApiRunning]);

  // Load responses on mount
  useEffect(() => {
    if (storageManager.db) {
      storageManager.getResponses(sessionId).then(setResponses).catch(console.error);
    }
  }, [sessionId, storageManager.db]);

  // File processing
  const handleFileUpload = useCallback((uploadedFile) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError("");

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(
            `CSV parsing errors: ${results.errors
              .map((e) => e.message)
              .join(", ")}`
          );
          setLoading(false);
          return;
        }

        const data = results.data.filter((row) =>
          Object.values(row).some(
            (val) => val !== null && val !== undefined && String(val).trim()
          )
        );

        setCsvData(data);
        setFields(analyzeFields(data));
        setSchemas(detectSchemas(data));
        setLoading(false);
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
        setLoading(false);
      },
    });
  }, []);

  // API Integration functions
  const addApiLog = (message, type = "info") => {
    setApiLogs((prev) =>
      [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          message,
          type,
        },
      ].slice(-100)
    );
  };

  const sendBatch = async (batch, batchNumber) => {
    try {
      let payload;
      
      const processedBatch = batch.map((item) => {
        const filtered = {};
        selectedApiFields.forEach((field) => {
          if (item[field] !== undefined) {
            filtered[field] = item[field];
          }
        });
        return filtered;
      });

      // Format payload based on configuration
      if (apiConfig.payloadFormat === "array") {
        payload = { items: processedBatch };
      } else {
        // Single object format - send each item individually
        payload = {
          ...processedBatch[0],
          listId: "68a5adb47b12882b02f4e412",
          source: "api",
          createdBy: "CSV Anlytics - Golden Salman"
        }; // For single format, we'll send one at a time
      }

      const headers = {};
      apiHeaders.forEach((h) => {
        if (h.key.trim() && h.value.trim()) {
          headers[h.key.trim()] = h.value.trim();
        }
      });

      const startTime = Date.now();
      const response = await fetch(apiConfig.url, {
        method: apiConfig.method,
        headers,
        body: JSON.stringify(payload),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = { text: await response.text() };
      }

      // Save response to storage
      const responseRecord = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        timestamp: new Date().toISOString(),
        batchNumber,
        request: {
          url: apiConfig.url,
          method: apiConfig.method,
          headers,
          payload,
          batchSize: batch.length,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
          responseTime,
        },
        success: response.ok,
      };

      await storageManager.saveResponse(responseRecord);
      setResponses(prev => [...prev, responseRecord]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      addApiLog(
        `Batch ${batchNumber}: Successfully sent ${batch.length} records (${responseTime}ms)`,
        "success"
      );
      setSendProgress((prev) => ({ ...prev, sent: prev.sent + batch.length }));

      return { success: true, result: responseData };
    } catch (error) {
      // Save error response
      const errorRecord = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        timestamp: new Date().toISOString(),
        batchNumber,
        request: {
          url: apiConfig.url,
          method: apiConfig.method,
          batchSize: batch.length,
        },
        response: {
          error: error.message,
        },
        success: false,
      };

      await storageManager.saveResponse(errorRecord);
      setResponses(prev => [...prev, errorRecord]);

      addApiLog(`Batch ${batchNumber}: Error - ${error.message}`, "error");
      setSendProgress((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return { success: false, error: error.message };
    }
  };

  const startApiIntegration = () => {
    if (!apiConfig.url || selectedApiFields.size === 0) {
      addApiLog("Please configure API URL and select fields", "error");
      return;
    }

    const dataToSend = selectedSchema
      ? csvData.filter((_, index) => selectedSchema.rows.includes(index))
      : csvData;

    if (!dataToSend.length) {
      addApiLog("No data to send", "error");
      return;
    }

    setIsApiRunning(true);
    setSendProgress({ sent: 0, total: dataToSend.length, errors: 0 });
    addApiLog(
      `Starting API integration: ${dataToSend.length} records in batches of ${apiConfig.batchSize}`,
      "info"
    );

    let currentIndex = 0;
    let batchNumber = 1;

    intervalRef.current = setInterval(async () => {
      if (currentIndex >= dataToSend.length) {
        stopApiIntegration();
        addApiLog("All data sent successfully!", "success");
        return;
      }

      const batchSize = apiConfig.payloadFormat === "single" ? 1 : apiConfig.batchSize;
      const batch = dataToSend.slice(currentIndex, currentIndex + batchSize);
      
      await sendBatch(batch, batchNumber);

      currentIndex += batchSize;
      batchNumber++;
    }, apiConfig.interval);
  };

  const stopApiIntegration = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsApiRunning(false);
    addApiLog("API integration stopped", "info");
  };

  const clearResponseHistory = async () => {
    await storageManager.clearSession(sessionId);
    setResponses([]);
    addApiLog("Response history cleared", "info");
  };

  // Filtered data
  const filteredFields = useMemo(() => {
    let filtered = fields;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().includes(s) ||
          f.samples.some((sample) => String(sample).toLowerCase().includes(s))
      );
    }

    if (fieldFilter !== "all") {
      filtered = filtered.filter((f) => {
        const completeness = parseFloat(f.completeness);
        switch (fieldFilter) {
          case "complete":
            return completeness === 100;
          case "incomplete":
            return completeness > 0 && completeness < 100;
          case "empty":
            return completeness === 0;
          default:
            return true;
        }
      });
    }

    if (dataTypeFilter !== "all") {
      filtered = filtered.filter((f) => f.dataType === dataTypeFilter);
    }

    return filtered;
  }, [fields, search, fieldFilter, dataTypeFilter]);

  const filteredData = useMemo(() => {
    if (!selectedSchema) return csvData;
    return csvData.filter((_, index) => selectedSchema.rows.includes(index));
  }, [csvData, selectedSchema]);

  // Filtered responses
  const filteredResponses = useMemo(() => {
    if (responseFilter === "all") return responses;
    if (responseFilter === "success") return responses.filter(r => r.success);
    if (responseFilter === "error") return responses.filter(r => !r.success);
    return responses;
  }, [responses, responseFilter]);

  // Response analytics
  const responseAnalytics = useMemo(() => {
    if (!responses.length) return null;

    const totalRequests = responses.length;
    const successfulRequests = responses.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = ((successfulRequests / totalRequests) * 100).toFixed(1);
    
    const responseTimes = responses
      .filter(r => r.response?.responseTime)
      .map(r => r.response.responseTime);
    
    const avgResponseTime = responseTimes.length
      ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0)
      : 0;

    // Status code distribution
    const statusCodes = {};
    responses.forEach(r => {
      const status = r.response?.status || 'error';
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });

    // Timeline data for chart
    const timelineData = responses.map((r, index) => ({
      request: index + 1,
      responseTime: r.response?.responseTime || 0,
      success: r.success ? 1 : 0,
      timestamp: new Date(r.timestamp).getTime(),
    }));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      avgResponseTime,
      statusCodes,
      timelineData,
    };
  }, [responses]);

  // Statistics
  const stats = useMemo(() => {
    if (!csvData.length)
      return {
        totalRows: 0,
        totalFields: 0,
        completeness: 0,
        uniqueSchemas: 0,
      };

    const totalFields = fields.length;
    const totalCells = csvData.length * totalFields;
    const filledCells = fields.reduce((sum, f) => sum + f.filledRecords, 0);
    const completeness = totalCells
      ? ((filledCells / totalCells) * 100).toFixed(1)
      : 0;

    return {
      totalRows: csvData.length,
      totalFields,
      completeness,
      uniqueSchemas: schemas.length,
    };
  }, [csvData, fields, schemas]);

  // Chart data
  const fieldCompletenessData = useMemo(
    () =>
      fields.slice(0, 10).map((f) => ({
        name: f.name.length > 15 ? f.name.substring(0, 15) + "..." : f.name,
        completeness: parseFloat(f.completeness),
        filled: f.filledRecords,
        empty: f.emptyRecords,
      })),
    [fields]
  );

  const dataTypeDistribution = useMemo(() => {
    const types = {};
    fields.forEach((f) => {
      types[f.dataType] = (types[f.dataType] || 0) + 1;
    });
    return Object.entries(types).map(([type, count]) => ({ type, count }));
  }, [fields]);

  const schemaDistribution = useMemo(
    () =>
      schemas.map((s) => ({
        name: `Schema ${s.id} (${s.fields.length} fields)`,
        count: s.count,
        percentage: parseFloat(s.percentage),
      })),
    [schemas]
  );

  const COLORS = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
  ];

  return (
    <SidebarWrapper>
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              CSV Data Analyzer
              <InfoTooltip
                content="Upload CSV files to analyze data patterns, detect schemas, and send data to APIs with advanced batching controls and response tracking"
                position="right"
              />
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              Upload, analyze, and efficiently distribute your CSV data to client APIs with complete response history
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <FiZap className="text-blue-500" />
            <span>Client-side processing • Persistent storage • Response analytics</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* File Upload Section */}
        {!csvData.length ? (
          <div className="bg-white border-2 border-dashed border-zinc-300 rounded-xl p-12 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e.target.files[0])}
              className="hidden"
            />

            {loading ? (
              <div className="flex flex-col items-center">
                <ImSpinner5 className="animate-spin text-4xl text-zinc-400 mb-4" />
                <p className="text-zinc-600">Processing your CSV file...</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Analyzing data patterns and schemas
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-blue-50 rounded-full p-6 mb-4">
                  <FiUpload className="text-3xl text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Upload your CSV file
                </h3>
                <p className="text-zinc-600 mb-6 max-w-md">
                  Drop your CSV file here or click to browse. We'll analyze the data structure, detect schemas, provide API integration tools, and track all responses with detailed analytics.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <FiFile />
                  Choose CSV File
                </button>

                <div className="mt-6 text-xs text-zinc-500 max-w-lg">
                  <p className="font-medium mb-1">Enhanced Features:</p>
                  <div className="text-left space-y-1">
                    <p>• Persistent storage survives browser refreshes</p>
                    <p>• Complete response history with analytics</p>
                    <p>• Flexible payload formats (array/single object)</p>
                    <p>• Real-time response time monitoring</p>
                    <p>• Detailed error tracking and success metrics</p>
                    <p>• Advanced data visualization and filtering</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-left max-w-2xl mx-auto">
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Error processing file</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MiniCard
                title="Total Records"
                subLine={stats.totalRows.toLocaleString()}
                icon={<FiDatabase />}
                color="text-blue-600"
                tooltip="Total number of valid data rows found in your CSV file"
              />
              <MiniCard
                title="Total Fields"
                subLine={stats.totalFields}
                icon={<FiBarChart />}
                color="text-emerald-600"
                tooltip="Number of unique columns/fields detected across all records"
              />
              <MiniCard
                title="Data Completeness"
                subLine={`${stats.completeness}%`}
                icon={<FiPieChart />}
                color="text-amber-600"
                tooltip="Percentage of non-empty cells across all fields and records"
              />
              <MiniCard
                title="API Responses"
                subLine={responses.length}
                icon={<FiActivity />}
                color="text-purple-600"
                tooltip="Total number of API responses received and stored"
              />
            </div>

            {/* File Info */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 rounded-lg p-2">
                  <FiCheck className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">{file?.name}</p>
                  <p className="text-sm text-zinc-600">
                    {file?.size ? `${(file.size / 1024).toFixed(1)} KB` : ""} •
                    Processed {csvData.length} records • Session: {sessionId.slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {responses.length > 0 && (
                  <button
                    onClick={() => setActiveTab("responses")}
                    className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 flex items-center gap-1"
                  >
                    <FiActivity className="w-3 h-3" />
                    View Responses ({responses.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setCsvData([]);
                    setFields([]);
                    setSchemas([]);
                    setFile(null);
                    setError("");
                    setSelectedSchema(null);
                    stopApiIntegration();
                    clearResponseHistory();
                  }}
                  className="text-zinc-500 hover:text-zinc-700 p-2"
                  title="Clear data and upload new file"
                >
                  <FiX />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border border-zinc-200 rounded-lg mb-6">
              <div className="border-b border-zinc-200 px-6 py-3">
                <div className="flex gap-6 overflow-x-auto">
                  {[
                    {
                      id: "overview",
                      label: "Overview",
                      icon: FiPieChart,
                      desc: "Visual analysis and statistics",
                    },
                    {
                      id: "fields",
                      label: "Field Analysis",
                      icon: FiBarChart,
                      desc: "Detailed field metrics",
                    },
                    {
                      id: "schemas",
                      label: "Schema Detection",
                      icon: FiDatabase,
                      desc: "Data pattern analysis",
                    },
                    {
                      id: "data",
                      label: "Data Preview",
                      icon: FiFile,
                      desc: "Raw data inspection",
                    },
                    {
                      id: "api",
                      label: "API Integration",
                      icon: FiSend,
                      desc: "Send data to external APIs",
                    },
                    {
                      id: "responses",
                      label: `Responses ${responses.length > 0 ? `(${responses.length})` : ''}`,
                      icon: FiActivity,
                      desc: "API response history and analytics",
                    },
                  ].map(({ id, label, icon: Icon, desc }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors group whitespace-nowrap ${
                        activeTab === id
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                      }`}
                      title={desc}
                    >
                      <Icon className="text-sm" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">
                        Data Analysis Overview
                      </h2>
                      <InfoTooltip content="Visual representation of your data quality, types, and schema distribution patterns" />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Field Completeness */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            Field Completeness
                          </h3>
                          <InfoTooltip content="Shows what percentage of records have data for each field. Higher bars indicate more complete fields." />
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fieldCompletenessData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 100]} />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${value}%`,
                                  "Completeness",
                                ]}
                                labelFormatter={(label) => `Field: ${label}`}
                              />
                              <Bar dataKey="completeness" fill="#3b82f6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Data Type Distribution */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            Data Type Distribution
                          </h3>
                          <InfoTooltip content="Automatically detected data types in your fields. Helps identify emails, phones, numbers, and other structured data." />
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={dataTypeDistribution}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ type, count }) =>
                                  `${type} (${count})`
                                }
                              >
                                {dataTypeDistribution.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Schema Distribution */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold text-zinc-900">
                          Schema Distribution
                        </h3>
                        <InfoTooltip content="Different data patterns found in your CSV. Each schema represents records with the same field combinations." />
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={schemaDistribution}
                            layout="horizontal"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={150}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value) => [
                                `${value} records`,
                                "Count",
                              ]}
                            />
                            <Bar dataKey="count" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* API Response Overview */}
                    {responseAnalytics && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            API Response Overview
                          </h3>
                          <InfoTooltip content="Summary of your API integration performance and response patterns" />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-emerald-800">Success Rate</p>
                            <p className="text-2xl font-bold text-emerald-900">{responseAnalytics.successRate}%</p>
                            <p className="text-xs text-emerald-700">{responseAnalytics.successfulRequests}/{responseAnalytics.totalRequests} requests</p>
                          </div>
                          
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-blue-800">Avg Response Time</p>
                            <p className="text-2xl font-bold text-blue-900">{responseAnalytics.avgResponseTime}ms</p>
                            <p className="text-xs text-blue-700">Average across all requests</p>
                          </div>
                          
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-purple-800">Total Requests</p>
                            <p className="text-2xl font-bold text-purple-900">{responseAnalytics.totalRequests}</p>
                            <p className="text-xs text-purple-700">API calls made</p>
                          </div>
                          
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-red-800">Failed Requests</p>
                            <p className="text-2xl font-bold text-red-900">{responseAnalytics.failedRequests}</p>
                            <p className="text-xs text-red-700">Errors encountered</p>
                          </div>
                        </div>

                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={responseAnalytics.timelineData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="request" />
                              <YAxis />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${value}ms`,
                                  "Response Time",
                                ]}
                                labelFormatter={(label) => `Request #${label}`}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="responseTime" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', r: 3 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fields Tab */}
                {activeTab === "fields" && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">Field Analysis</h2>
                      <InfoTooltip content="Detailed analysis of each field including data types, completeness, and sample values" />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                      <div className="flex-1 relative">
                        <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
                        <input
                          className={`pl-9 ${inputStyles}`}
                          placeholder="Search fields by name or sample values..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Dropdown
                        options={[
                          { value: "all", label: "All Fields" },
                          { value: "complete", label: "100% Complete" },
                          { value: "incomplete", label: "Partially Complete" },
                          { value: "empty", label: "Empty Fields" },
                        ]}
                        value={fieldFilter}
                        onChange={setFieldFilter}
                        placeholder="Filter by completeness"
                      />
                      <Dropdown
                        options={[
                          { value: "all", label: "All Types" },
                          ...Array.from(
                            new Set(fields.map((f) => f.dataType))
                          ).map((type) => ({
                            value: type,
                            label: type.charAt(0).toUpperCase() + type.slice(1),
                          })),
                        ]}
                        value={dataTypeFilter}
                        onChange={setDataTypeFilter}
                        placeholder="Filter by data type"
                      />
                    </div>

                    {/* Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredFields.map((field) => (
                        <div
                          key={field.name}
                          className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-zinc-900 truncate flex-1 mr-2">
                              {field.name}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded shrink-0 ${
                                field.dataType === "email"
                                  ? "bg-blue-100 text-blue-800"
                                  : field.dataType === "number"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : field.dataType === "phone"
                                  ? "bg-purple-100 text-purple-800"
                                  : field.dataType === "date"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-zinc-100 text-zinc-800"
                              }`}
                            >
                              {field.dataType}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-zinc-600">
                                Completeness:
                              </span>
                              <span
                                className={`font-medium ${
                                  parseFloat(field.completeness) === 100
                                    ? "text-emerald-600"
                                    : parseFloat(field.completeness) > 50
                                    ? "text-amber-600"
                                    : "text-red-600"
                                }`}
                              >
                                {field.completeness}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">Records:</span>
                              <span>
                                {field.filledRecords}/{field.totalRecords}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">
                                Unique values:
                              </span>
                              <span>{field.uniqueValues.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">Avg length:</span>
                              <span>{field.avgLength} chars</span>
                            </div>
                          </div>

                          {field.samples.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-200">
                              <p className="text-xs text-zinc-600 mb-1 flex items-center gap-1">
                                Sample values
                                <InfoTooltip
                                  content="First few unique values found in this field"
                                  position="right"
                                />
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {field.samples.slice(0, 3).map((sample, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-white px-2 py-1 rounded border truncate max-w-24"
                                  >
                                    {String(sample).substring(0, 15)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schemas Tab */}
                {activeTab === "schemas" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">
                        Schema Detection
                      </h2>
                      <InfoTooltip content="Groups of records with similar field patterns. Useful for understanding data structure variations." />
                    </div>

                    <p className="text-zinc-600 mb-6">
                      Found {schemas.length} different data schemas in your CSV.
                      Each schema represents records with the same field
                      combinations.
                    </p>

                    {schemas.map((schema) => (
                      <div
                        key={schema.id}
                        className="border border-zinc-200 rounded-lg overflow-hidden"
                      >
                        <div className="p-4 bg-zinc-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setExpandedSchemas((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(schema.id))
                                    next.delete(schema.id);
                                  else next.add(schema.id);
                                  return next;
                                });
                              }}
                              className="text-zinc-600 hover:text-zinc-900"
                            >
                              {expandedSchemas.has(schema.id) ? (
                                <FiChevronDown />
                              ) : (
                                <FiChevronRight />
                              )}
                            </button>
                            <div>
                              <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                                Schema {schema.id} ({schema.fields.length}{" "}
                                fields)
                                <InfoTooltip
                                  content={`Records containing exactly these fields: ${schema.fields.join(
                                    ", "
                                  )}`}
                                />
                              </h3>
                              <p className="text-sm text-zinc-600">
                                {schema.count} records ({schema.percentage}% of
                                data)
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedSchema(schema);
                                setActiveTab("data");
                              }}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                              <FiFile className="w-3 h-3" />
                              View Data
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSchema(schema);
                                setSelectedApiFields(new Set(schema.fields));
                                setActiveTab("api");
                              }}
                              className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <FiSend className="w-3 h-3" />
                              Setup API
                            </button>
                          </div>
                        </div>

                        {expandedSchemas.has(schema.id) && (
                          <div className="p-4 border-t border-zinc-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {schema.fields.map((field) => (
                                <div
                                  key={field}
                                  className="bg-white p-3 rounded border"
                                >
                                  <p className="font-medium text-sm text-zinc-900">
                                    {field}
                                  </p>
                                  <p className="text-xs text-zinc-600 mt-1">
                                    Examples:{" "}
                                    {schema.examples[field]
                                      ?.slice(0, 2)
                                      .join(", ") || "—"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Tab */}
                {activeTab === "data" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Data Preview</h2>
                        <InfoTooltip content="Raw data from your CSV file. Filter by schema to see specific data patterns." />
                      </div>
                      <p className="text-zinc-600">
                        {selectedSchema
                          ? `Showing ${filteredData.length} records from Schema ${selectedSchema.id}`
                          : `Showing all ${csvData.length} records`}
                      </p>
                    </div>

                    {selectedSchema && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiFilter className="text-blue-600" />
                          <span className="text-sm text-blue-800">
                            Filtered to Schema {selectedSchema.id} with fields:{" "}
                            {selectedSchema.fields.join(", ")}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedSchema(null)}
                          className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          Show all data
                        </button>
                      </div>
                    )}

                    <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-zinc-900 w-16">
                              #
                            </th>
                            {fields.slice(0, 8).map((field) => (
                              <th
                                key={field.name}
                                className="text-left px-3 py-2 font-medium text-zinc-900 min-w-32"
                              >
                                <div className="flex items-center gap-1">
                                  {field.name}
                                  <span
                                    className={`text-xs px-1 py-0.5 rounded ${
                                      field.dataType === "email"
                                        ? "bg-blue-100 text-blue-600"
                                        : field.dataType === "number"
                                        ? "bg-emerald-100 text-emerald-600"
                                        : field.dataType === "phone"
                                        ? "bg-purple-100 text-purple-600"
                                        : "bg-zinc-100 text-zinc-600"
                                    }`}
                                  >
                                    {field.dataType}
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {filteredData.slice(0, 100).map((row, index) => (
                            <tr key={index} className="hover:bg-zinc-50">
                              <td className="px-3 py-2 text-zinc-500 text-xs">
                                {index + 1}
                              </td>
                              {fields.slice(0, 8).map((field) => (
                                <td
                                  key={field.name}
                                  className="px-3 py-2 text-zinc-900"
                                >
                                  <div
                                    className="max-w-40 truncate"
                                    title={row[field.name] || ""}
                                  >
                                    {row[field.name] || (
                                      <span className="text-zinc-400">—</span>
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredData.length > 100 && (
                      <p className="text-sm text-zinc-600 mt-3 text-center">
                        Showing first 100 rows of {filteredData.length} total
                        records
                      </p>
                    )}
                  </div>
                )}

                {/* API Integration Tab */}
                {activeTab === "api" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">API Integration</h2>
                      <InfoTooltip content="Configure and send your CSV data to external APIs with batching, rate limiting, and progress monitoring" />
                    </div>

                    {/* Configuration Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* API Configuration */}
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          API Configuration
                          <InfoTooltip content="Set up your client's API endpoint and request parameters" />
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className={labelStyles("required")}>
                              API Endpoint URL
                            </label>
                            <input
                              type="url"
                              value={apiConfig.url}
                              onChange={(e) =>
                                setApiConfig((prev) => ({
                                  ...prev,
                                  url: e.target.value,
                                }))
                              }
                              placeholder="https://api.client.com/users"
                              className={inputStyles}
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                              Your client's API endpoint that will receive the
                              data
                            </p>
                          </div>

                          <div>
                            <label className={labelStyles()}>HTTP Method</label>
                            <select
                              value={apiConfig.method}
                              onChange={(e) =>
                                setApiConfig((prev) => ({
                                  ...prev,
                                  method: e.target.value,
                                }))
                              }
                              className={inputStyles}
                            >
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="PATCH">PATCH</option>
                            </select>
                          </div>

                          {/* NEW: Payload Format Selection */}
                          <div>
                            <label className={labelStyles()}>
                              Payload Format
                            </label>
                            <div className="flex gap-4 mt-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="payloadFormat"
                                  value="array"
                                  checked={apiConfig.payloadFormat === "array"}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      payloadFormat: e.target.value,
                                    }))
                                  }
                                />
                                <div>
                                  <span className="text-sm font-medium">Array Format</span>
                                  <p className="text-xs text-zinc-500">{"{ items: [{ email: '', name: '' }] }"}</p>
                                </div>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="payloadFormat"
                                  value="single"
                                  checked={apiConfig.payloadFormat === "single"}
                                  onChange={(e) =>
                                    setApiConfig((prev) => ({
                                      ...prev,
                                      payloadFormat: e.target.value,
                                    }))
                                  }
                                />
                                <div>
                                  <span className="text-sm font-medium">Single Object</span>
                                 <p className="text-xs text-zinc-500">{"{ email: '', name: '' }"}</p>
                                </div>
                              </label>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                              Choose how data is structured in the request body. Array format sends multiple records per request, single object sends one record per request.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelStyles()}>
                                Batch Size
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={apiConfig.batchSize}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    batchSize: parseInt(e.target.value) || 20,
                                  }))
                                }
                                className={inputStyles}
                                disabled={apiConfig.payloadFormat === "single"}
                              />
                              <p className="text-xs text-zinc-500 mt-1">
                                {apiConfig.payloadFormat === "single" 
                                  ? "Always 1 for single object format"
                                  : "Records per request"}
                              </p>
                            </div>

                            <div>
                              <label className={labelStyles()}>
                                Interval (ms)
                              </label>
                              <input
                                type="number"
                                min="100"
                                max="60000"
                                step="100"
                                value={apiConfig.interval}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    interval: parseInt(e.target.value) || 5000,
                                  }))
                                }
                                className={inputStyles}
                              />
                              <p className="text-xs text-zinc-500 mt-1">
                                Delay between requests
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Headers Configuration */}
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          Request Headers
                          <InfoTooltip content="Configure authentication and other headers for your API requests" />
                        </h3>

                        <div className="space-y-3">
                          {apiHeaders.map((header, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                placeholder="Header name"
                                value={header.key}
                                onChange={(e) => {
                                  const newHeaders = [...apiHeaders];
                                  newHeaders[index].key = e.target.value;
                                  setApiHeaders(newHeaders);
                                }}
                                className={`${inputStyles} flex-1`}
                              />
                              <input
                                placeholder="Header value"
                                value={header.value}
                                onChange={(e) => {
                                  const newHeaders = [...apiHeaders];
                                  newHeaders[index].value = e.target.value;
                                  setApiHeaders(newHeaders);
                                }}
                                className={`${inputStyles} flex-1`}
                              />
                              <button
                                onClick={() =>
                                  setApiHeaders((headers) =>
                                    headers.filter((_, i) => i !== index)
                                  )
                                }
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded border border-red-200"
                              >
                                <FiX />
                              </button>
                            </div>
                          ))}

                          <button
                            onClick={() =>
                              setApiHeaders([
                                ...apiHeaders,
                                { key: "", value: "" },
                              ])
                            }
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Header
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Field Selection */}
                    <div className="bg-white border border-zinc-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                          Select Fields to Send
                          <InfoTooltip content="Choose which fields from your CSV to include in API requests" />
                        </h3>
                        {selectedSchema && (
                          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Schema {selectedSchema.id} ({selectedApiFields.size}
                            /{selectedSchema.fields.length} fields selected)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {(selectedSchema
                          ? selectedSchema.fields
                          : fields.map((f) => f.name)
                        ).map((fieldName) => (
                          <label
                            key={fieldName}
                            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded cursor-pointer hover:bg-zinc-50"
                          >
                            <ToggleLiver
                              checked={selectedApiFields.has(fieldName)}
                              onChange={(checked) => {
                                setSelectedApiFields((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(fieldName);
                                  else next.delete(fieldName);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">
                                {fieldName}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {fields.find((f) => f.name === fieldName)
                                  ?.dataType || "text"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>

                      {selectedApiFields.size === 0 && (
                        <p className="bg-amber-100 text-amber-600 text-sm px-3 py-2 mt-3 rounded flex items-center gap-1">
                          <FiAlertCircle />
                          Please select at least one field to send
                        </p>
                      )}
                    </div>

                    {/* Control Panel */}
                    <div className="bg-white border border-zinc-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-zinc-900">
                          Control Panel
                        </h3>
                        <div className="flex items-center gap-4">
                          {sendProgress.total > 0 && (
                            <div className="text-sm text-zinc-600">
                              Progress: {sendProgress.sent}/{sendProgress.total}
                              {sendProgress.errors > 0 && (
                                <span className="text-red-600 ml-2">
                                  ({sendProgress.errors} errors)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {!isApiRunning ? (
                          <button
                            onClick={startApiIntegration}
                            disabled={
                              !apiConfig.url || selectedApiFields.size === 0
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                          >
                            <FiPlay />
                            Start Sending Data
                          </button>
                        ) : (
                          <button
                            onClick={stopApiIntegration}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                          >
                            <FiPause />
                            Stop Integration
                          </button>
                        )}

                        <div className="text-sm text-zinc-600 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <FiUsers />
                            {selectedSchema
                              ? selectedSchema.count
                              : csvData.length}{" "}
                            records ready
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock />
                            ~{Math.ceil(
                              (((selectedSchema
                                ? selectedSchema.count
                                : csvData.length) /
                                (apiConfig.payloadFormat === "single" ? 1 : apiConfig.batchSize)) *
                                apiConfig.interval) /
                                1000
                            )}s total time
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Logs */}
                    {apiLogs.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          Activity Log
                          <InfoTooltip content="Real-time log of API requests, responses, and any errors encountered" />
                        </h3>

                        <div className="bg-zinc-50 rounded border max-h-64 overflow-y-auto">
                          {apiLogs.slice(-50).map((log, index) => (
                            <div
                              key={index}
                              className={`px-3 py-2 text-sm border-b border-zinc-200 last:border-b-0 ${
                                log.type === "error"
                                  ? "bg-red-50 text-red-800"
                                  : log.type === "success"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "text-zinc-700"
                              }`}
                            >
                              <span className="text-xs text-zinc-500 mr-2">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              {log.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Performance Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <FiZap />
                        Performance Tips for Faster Data Transfer
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>
                          • <strong>Payload Format:</strong> Use array format for bulk operations, single object for individual processing
                        </li>
                        <li>
                          • <strong>Optimal Batch Size:</strong> 20-50 records
                          per request for most APIs (array format only)
                        </li>
                        <li>
                          • <strong>Interval Timing:</strong> 1-5 seconds
                          between requests to avoid rate limits
                        </li>
                        <li>
                          • <strong>Field Selection:</strong> Send only required
                          fields to reduce payload size
                        </li>
                        <li>
                          • <strong>Error Handling:</strong> Monitor logs for
                          failed batches and retry mechanisms
                        </li>
                        <li>
                          • <strong>Schema Filtering:</strong> Use schema
                          detection to send consistent data structures
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Responses Tab */}
                {activeTab === "responses" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Response History & Analytics</h2>
                        <InfoTooltip content="Complete history of API responses with detailed analytics, performance metrics, and response data" />
                      </div>
                      <div className="flex items-center gap-2">
                        {responses.length > 0 && (
                          <button
                            onClick={clearResponseHistory}
                            className="text-sm px-3 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50 flex items-center gap-1"
                          >
                            <FiTrash2 className="w-3 h-3" />
                            Clear History
                          </button>
                        )}
                      </div>
                    </div>

                    {!responses.length ? (
                      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-12 text-center">
                        <FiActivity className="text-4xl text-zinc-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 mb-2">No API Responses Yet</h3>
                        <p className="text-zinc-600 mb-4">
                          Start sending data through the API Integration tab to see response history and analytics here.
                        </p>
                        <button
                          onClick={() => setActiveTab("api")}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                        >
                          <FiSend />
                          Configure API Integration
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Response Analytics Overview */}
                        {responseAnalytics && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <FiCheck className="text-emerald-600" />
                                <h3 className="font-medium text-emerald-900">Success Rate</h3>
                              </div>
                              <p className="text-2xl font-bold text-emerald-900">{responseAnalytics.successRate}%</p>
                              <p className="text-sm text-emerald-700">{responseAnalytics.successfulRequests}/{responseAnalytics.totalRequests} successful</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <FiClock className="text-blue-600" />
                                <h3 className="font-medium text-blue-900">Avg Response Time</h3>
                              </div>
                              <p className="text-2xl font-bold text-blue-900">{responseAnalytics.avgResponseTime}ms</p>
                              <p className="text-sm text-blue-700">Average across all requests</p>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <FiSend className="text-purple-600" />
                                <h3 className="font-medium text-purple-900">Total Requests</h3>
                              </div>
                              <p className="text-2xl font-bold text-purple-900">{responseAnalytics.totalRequests}</p>
                              <p className="text-sm text-purple-700">API calls made</p>
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <FiAlertCircle className="text-red-600" />
                                <h3 className="font-medium text-red-900">Failed Requests</h3>
                              </div>
                              <p className="text-2xl font-bold text-red-900">{responseAnalytics.failedRequests}</p>
                              <p className="text-sm text-red-700">Errors encountered</p>
                            </div>
                          </div>
                        )}

                        {/* Response Time Chart */}
                        {responseAnalytics && (
                          <div className="bg-white border border-zinc-200 rounded-lg p-4">
                            <h3 className="font-medium text-zinc-900 mb-4 flex items-center gap-2">
                              Response Time Timeline
                              <InfoTooltip content="Timeline showing response times for each API request" />
                            </h3>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={responseAnalytics.timelineData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="request" />
                                  <YAxis />
                                  <Tooltip
                                    formatter={(value, name) => [
                                      `${value}ms`,
                                      "Response Time",
                                    ]}
                                    labelFormatter={(label) => `Request #${label}`}
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="responseTime" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', r: 3 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Status Code Distribution */}
                        {responseAnalytics && (
                          <div className="bg-white border border-zinc-200 rounded-lg p-4">
                            <h3 className="font-medium text-zinc-900 mb-4 flex items-center gap-2">
                              Status Code Distribution
                              <InfoTooltip content="Breakdown of HTTP response status codes" />
                            </h3>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={Object.entries(responseAnalytics.statusCodes).map(([status, count]) => ({
                                      status,
                                      count,
                                      name: status === 'error' ? 'Network Error' : `HTTP ${status}`
                                    }))}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    label={({ name, count }) => `${name} (${count})`}
                                  >
                                    {Object.entries(responseAnalytics.statusCodes).map((entry, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={entry[0] === '200' ? '#10b981' : entry[0] === 'error' ? '#ef4444' : COLORS[index % COLORS.length]}
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Response Filters */}
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium text-zinc-700">Filter responses:</label>
                          <Dropdown
                            options={[
                              { value: "all", label: `All Responses (${responses.length})` },
                              { value: "success", label: `Successful (${responses.filter(r => r.success).length})` },
                              { value: "error", label: `Failed (${responses.filter(r => !r.success).length})` },
                            ]}
                            value={responseFilter}
                            onChange={setResponseFilter}
                          />
                        </div>

                        {/* Response Table */}
                        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Batch</th>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Timestamp</th>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Status</th>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Response Time</th>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Records</th>
                                  <th className="text-left px-4 py-3 font-medium text-zinc-900">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200">
                                {filteredResponses.slice(-50).reverse().map((response) => (
                                  <tr key={response.id} className="hover:bg-zinc-50">
                                    <td className="px-4 py-3 font-medium">#{response.batchNumber}</td>
                                    <td className="px-4 py-3 text-zinc-600">
                                      {new Date(response.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                          response.success
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {response.success ? (
                                          <>
                                            <FiCheck className="w-3 h-3" />
                                            {response.response?.status || 'Success'}
                                          </>
                                        ) : (
                                          <>
                                            <FiX className="w-3 h-3" />
                                            Error
                                          </>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600">
                                      {response.response?.responseTime ? `${response.response.responseTime}ms` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-600">
                                      {response.request?.batchSize || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        onClick={() => setSelectedResponse(response)}
                                        className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                                      >
                                        <FiEye className="w-3 h-3" />
                                        View Details
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {filteredResponses.length > 50 && (
                          <p className="text-sm text-zinc-600 text-center">
                            Showing last 50 responses of {filteredResponses.length} total
                          </p>
                        )}
                      </>
                    )}

                    {/* Response Detail Modal */}
                    {selectedResponse && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                          <div className="flex items-center justify-between p-4 border-b border-zinc-200">
                            <h3 className="text-lg font-semibold">
                              Response Details - Batch #{selectedResponse.batchNumber}
                            </h3>
                            <button
                              onClick={() => setSelectedResponse(null)}
                              className="text-zinc-500 hover:text-zinc-700"
                            >
                              <FiX />
                            </button>
                          </div>
                          
                          <div className="p-4 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Request Details */}
                              <div>
                                <h4 className="font-medium text-zinc-900 mb-3">Request Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">URL:</span>
                                    <span className="font-mono text-xs break-all">{selectedResponse.request?.url}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">Method:</span>
                                    <span className="font-mono">{selectedResponse.request?.method}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">Batch Size:</span>
                                    <span>{selectedResponse.request?.batchSize}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">Timestamp:</span>
                                    <span>{new Date(selectedResponse.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>
                                
                                {selectedResponse.request?.headers && (
                                  <div className="mt-4">
                                    <h5 className="font-medium text-zinc-900 mb-2">Headers</h5>
                                    <pre className="bg-zinc-50 p-3 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(selectedResponse.request.headers, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>

                              {/* Response Details */}
                              <div>
                                <h4 className="font-medium text-zinc-900 mb-3">Response Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">Status:</span>
                                    <span className={`font-medium ${
                                      selectedResponse.success ? 'text-emerald-600' : 'text-red-600'
                                    }`}>
                                      {selectedResponse.response?.status || 'Error'} {selectedResponse.response?.statusText}
                                    </span>
                                  </div>
                                  {selectedResponse.response?.responseTime && (
                                    <div className="flex justify-between">
                                      <span className="text-zinc-600">Response Time:</span>
                                      <span>{selectedResponse.response.responseTime}ms</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-zinc-600">Success:</span>
                                    <span className={selectedResponse.success ? 'text-emerald-600' : 'text-red-600'}>
                                      {selectedResponse.success ? 'Yes' : 'No'}
                                    </span>
                                  </div>
                                </div>

                                {selectedResponse.response?.headers && (
                                  <div className="mt-4">
                                    <h5 className="font-medium text-zinc-900 mb-2">Response Headers</h5>
                                    <pre className="bg-zinc-50 p-3 rounded text-xs overflow-x-auto max-h-32">
                                      {JSON.stringify(selectedResponse.response.headers, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Request Payload */}
                            {selectedResponse.request?.payload && (
                              <div className="mt-6">
                                <h4 className="font-medium text-zinc-900 mb-3">Request Payload</h4>
                                <pre className="bg-zinc-50 p-4 rounded text-xs overflow-x-auto max-h-48">
                                  {JSON.stringify(selectedResponse.request.payload, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Response Data */}
                            {selectedResponse.response?.data && (
                              <div className="mt-6">
                                <h4 className="font-medium text-zinc-900 mb-3">Response Data</h4>
                                <pre className="bg-zinc-50 p-4 rounded text-xs overflow-x-auto max-h-48">
                                  {JSON.stringify(selectedResponse.response.data, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Error Details */}
                            {selectedResponse.response?.error && (
                              <div className="mt-6">
                                <h4 className="font-medium text-red-900 mb-3">Error Details</h4>
                                <div className="bg-red-50 border border-red-200 rounded p-4">
                                  <p className="text-red-800 text-sm">{selectedResponse.response.error}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </SidebarWrapper>
  );
}