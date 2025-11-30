import { GoogleGenAI } from "@google/genai";
import { ProductionOrder, Seamstress } from "../types";

// The API Key is injected by vite.config.ts from the environment variable API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProductionInsights = async (
  orders: ProductionOrder[],
  seamstresses: Seamstress[]
): Promise<string> => {
  try {
    const dataContext = JSON.stringify({
      orders: orders.map(o => ({
        ref: o.referenceCode,
        status: o.status,
        fabric: o.fabric,
        totalItems: o.items.length,
        cuttingStock: o.activeCuttingItems.reduce((acc, i) => acc + i.actualPieces, 0),
        distributions: (o.splits || []).map(s => ({
            seamstress: s.seamstressName,
            status: s.status,
            pieces: s.items.reduce((acc, i) => acc + i.actualPieces, 0)
        }))
      })),
      seamstresses: seamstresses.map(s => ({ name: s.name, specialty: s.specialty }))
    });

    const prompt = `
      Você é um gerente de produção têxtil experiente da empresa "Kavin's".
      Analise os dados de produção abaixo (em JSON) e forneça um relatório executivo curto e direto.
      
      Foque em:
      1. Gargalos de produção (muitos itens parados em estoque de corte sem costureira?).
      2. Desempenho (quem está com muitos pacotes acumulados?).
      3. Sugestões de prioridade baseadas no status atual.
      4. Use formatação Markdown (negrito, bullet points).
      5. Seja motivador mas profissional.
      
      Dados:
      ${dataContext}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Erro ao gerar insights:", error);
    return "Erro ao conectar com a IA da Kavin's. Verifique sua chave de API nas configurações da Vercel.";
  }
};