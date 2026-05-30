import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Set up server limits for handling image base64 receipt uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Lazy initializer for Gemini client to prevent crashing if the key is not configured yet
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARN: GEMINI_API_KEY is not set. AI Features will be unavailable until added in Secrets.");
      throw new Error("GEMINI_API_KEY is required to use the scan and prediction habits features.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1) SCAN NOTA FISCAL (NF) ENDPOINT
app.post("/api/gemini/scan-nf", async (req, res) => {
  try {
    const { rawText, base64Image, mimeType } = req.body;
    const ai = getGeminiClient();

    let contents: any[] = [];
    let promptText = `Você é um leitor especialista de Nota Fiscal (NF) e cupons de supermercados no padrão brasileiro. 
Analise o conteúdo anexado (pode ser texto transcrito ou imagem do cupom) e extraia de forma estruturada:
- Todos os produtos listados: descreva o nome do produto de forma limpa, retire códigos técnicos, encontre a quantidade encontrada e tente determinar a categoria do produto em Português do Brasil (Laticínios, Mercearia, Frutas e Verduras, Carnes, Higiene, Limpeza, Bebidas, Padaria, Sobremesas, Pet Shop, Outros).
- Estime o preço unitário aproximado de cada item de acordo com a nota.
- O valor total do cupom fiscal.

Retorne SOMENTE o formato de dados estruturado requerido.`;

    if (base64Image) {
      contents.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Image,
        },
      });
    }

    if (rawText) {
      promptText += `\n\nTexto transcrito do cupom fiscal para conferência:\n${rawText}`;
    }

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              description: "Lista de itens extraídos da nota de supermercado",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome limpo do produto simplificado para lista de compras" },
                  quantity: { type: Type.NUMBER, description: "Quantidade comprada ou sugerida" },
                  estimatedPrice: { type: Type.NUMBER, description: "Preço unitário aproximado encontrado no cupom" },
                  category: { type: Type.STRING, description: "Categoria do produto em português" },
                },
                required: ["name", "quantity"],
              },
            },
            totalAmount: { type: Type.NUMBER, description: "Valor total do cupom fiscal consultado" },
          },
          required: ["items"],
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error scanning NF with Gemini:", error);
    res.status(500).json({ error: error.message || "Falha ao escanear a nota fiscal" });
  }
});

// 2) AI HABITS FORECASTING & SPEND REPORT BUDGET ENDPOINT
app.post("/api/gemini/habits-report", async (req, res) => {
  try {
    const { expenses, currentListItems } = req.body;
    const ai = getGeminiClient();

    const promptText = `Como um analista financeiro inteligente e assistente doméstico inteligente, analise o perfil de gastos e itens de supermercado desta família brasileira.

Dados Históricos de Compras Recentes da Família (Expenses):
${JSON.stringify(expenses, null, 2)}

Itens atualmente na lista de compras (Current list):
${JSON.stringify(currentListItems, null, 2)}

Gere um relatório de hábitos de gastos e uma previsão de orçamento mensal. Faça estimativas plausíveis em Reais (R$) baseando-se no número de itens e histórico de despesas fornecidas. Se não houver histórico considerável, calcule com base nos itens atuais da lista.
Retorne de forma estruturada:
1. 'predictedMonthlySpent': Estimativa total aproximada de gastos para o mês em Reais.
2. 'categorySpendRecommendation': Recomendação de limite de orçamento para categorias chave (limpeza, mercearia, etc.).
3. 'habitsComparison': Uma análise qualitativa detalhada comentando o padrão de gastos com base nas categorias mais movimentadas ou quantidade de itens.
4. 'savingsTips': Pelo menos 4 dicas práticas em português para ajudar esta família a economizar nas compras de mercado.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedMonthlySpent: { type: Type.NUMBER, description: "Valor final estimado de gasto mensal aproximado" },
            categorySpendRecommendation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  suggestedLimit: { type: Type.NUMBER },
                },
                required: ["category", "suggestedLimit"],
              },
            },
            habitsComparison: { type: Type.STRING, description: "Apreciação dos hábitos de consumo e perfil familiar" },
            savingsTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Dicas personalizadas em português para reduzir custos",
            },
          },
          required: ["predictedMonthlySpent", "categorySpendRecommendation", "habitsComparison", "savingsTips"],
        },
      },
    });

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Error generating habits report:", error);
    res.status(500).json({ error: error.message || "Erro ao calcular orçamento" });
  }
});

// Configure Vite integration or static file serve
if (process.env.NODE_ENV !== "production") {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    
    // Start listening
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[DEV] Fullstack Server listening on http://localhost:${PORT}`);
    });
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PROD] Fullstack Server listening on port ${PORT}`);
  });
}
