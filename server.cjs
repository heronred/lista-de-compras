var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "15mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "15mb" }));
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARN: GEMINI_API_KEY is not set. AI Features will be unavailable until added in Secrets.");
      throw new Error("GEMINI_API_KEY is required to use the scan and prediction habits features.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.post("/api/gemini/scan-nf", async (req, res) => {
  try {
    const { rawText, base64Image, mimeType } = req.body;
    const ai = getGeminiClient();
    let contents = [];
    let promptText = `Voc\xEA \xE9 um leitor especialista de Nota Fiscal (NF) e cupons de supermercados no padr\xE3o brasileiro. 
Analise o conte\xFAdo anexado (pode ser texto transcrito ou imagem do cupom) e extraia de forma estruturada:
- Todos os produtos listados: descreva o nome do produto de forma limpa, retire c\xF3digos t\xE9cnicos, encontre a quantidade encontrada e tente determinar a categoria do produto em Portugu\xEAs do Brasil (Latic\xEDnios, Mercearia, Frutas e Verduras, Carnes, Higiene, Limpeza, Bebidas, Padaria, Sobremesas, Pet Shop, Outros).
- Estime o pre\xE7o unit\xE1rio aproximado de cada item de acordo com a nota.
- O valor total do cupom fiscal.

Retorne SOMENTE o formato de dados estruturado requerido.`;
    if (base64Image) {
      contents.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Image
        }
      });
    }
    if (rawText) {
      promptText += `

Texto transcrito do cupom fiscal para confer\xEAncia:
${rawText}`;
    }
    contents.push({ text: promptText });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            items: {
              type: import_genai.Type.ARRAY,
              description: "Lista de itens extra\xEDdos da nota de supermercado",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  name: { type: import_genai.Type.STRING, description: "Nome limpo do produto simplificado para lista de compras" },
                  quantity: { type: import_genai.Type.NUMBER, description: "Quantidade comprada ou sugerida" },
                  estimatedPrice: { type: import_genai.Type.NUMBER, description: "Pre\xE7o unit\xE1rio aproximado encontrado no cupom" },
                  category: { type: import_genai.Type.STRING, description: "Categoria do produto em portugu\xEAs" }
                },
                required: ["name", "quantity"]
              }
            },
            totalAmount: { type: import_genai.Type.NUMBER, description: "Valor total do cupom fiscal consultado" }
          },
          required: ["items"]
        }
      }
    });
    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error) {
    console.error("Error scanning NF with Gemini:", error);
    res.status(500).json({ error: error.message || "Falha ao escanear a nota fiscal" });
  }
});
app.post("/api/gemini/habits-report", async (req, res) => {
  try {
    const { expenses, currentListItems } = req.body;
    const ai = getGeminiClient();
    const promptText = `Como um analista financeiro inteligente e assistente dom\xE9stico inteligente, analise o perfil de gastos e itens de supermercado desta fam\xEDlia brasileira.

Dados Hist\xF3ricos de Compras Recentes da Fam\xEDlia (Expenses):
${JSON.stringify(expenses, null, 2)}

Itens atualmente na lista de compras (Current list):
${JSON.stringify(currentListItems, null, 2)}

Gere um relat\xF3rio de h\xE1bitos de gastos e uma previs\xE3o de or\xE7amento mensal. Fa\xE7a estimativas plaus\xEDveis em Reais (R$) baseando-se no n\xFAmero de itens e hist\xF3rico de despesas fornecidas. Se n\xE3o houver hist\xF3rico consider\xE1vel, calcule com base nos itens atuais da lista.
Retorne de forma estruturada:
1. 'predictedMonthlySpent': Estimativa total aproximada de gastos para o m\xEAs em Reais.
2. 'categorySpendRecommendation': Recomenda\xE7\xE3o de limite de or\xE7amento para categorias chave (limpeza, mercearia, etc.).
3. 'habitsComparison': Uma an\xE1lise qualitativa detalhada comentando o padr\xE3o de gastos com base nas categorias mais movimentadas ou quantidade de itens.
4. 'savingsTips': Pelo menos 4 dicas pr\xE1ticas em portugu\xEAs para ajudar esta fam\xEDlia a economizar nas compras de mercado.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            predictedMonthlySpent: { type: import_genai.Type.NUMBER, description: "Valor final estimado de gasto mensal aproximado" },
            categorySpendRecommendation: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  category: { type: import_genai.Type.STRING },
                  suggestedLimit: { type: import_genai.Type.NUMBER }
                },
                required: ["category", "suggestedLimit"]
              }
            },
            habitsComparison: { type: import_genai.Type.STRING, description: "Aprecia\xE7\xE3o dos h\xE1bitos de consumo e perfil familiar" },
            savingsTips: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "Dicas personalizadas em portugu\xEAs para reduzir custos"
            }
          },
          required: ["predictedMonthlySpent", "categorySpendRecommendation", "habitsComparison", "savingsTips"]
        }
      }
    });
    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error) {
    console.error("Error generating habits report:", error);
    res.status(500).json({ error: error.message || "Erro ao calcular or\xE7amento" });
  }
});
if (process.env.NODE_ENV !== "production") {
  (0, import_vite.createServer)({
    server: { middlewareMode: true },
    appType: "spa"
  }).then((vite) => {
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[DEV] Fullstack Server listening on http://localhost:${PORT}`);
    });
  });
} else {
  const distPath = import_path.default.join(process.cwd(), "dist");
  app.use(import_express.default.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(import_path.default.join(distPath, "index.html"));
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PROD] Fullstack Server listening on port ${PORT}`);
  });
}
//# sourceMappingURL=server.cjs.map
