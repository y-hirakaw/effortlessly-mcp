import * as ort from 'onnxruntime-node';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

const logger = Logger.getInstance();

/**
 * all-MiniLM-L6-v2モデルを直接ONNX経由で使用する軽量セマンティック検索
 * 外部依存を最小化し、セキュアなローカル実行を実現
 */
export class DirectMiniLMEmbeddings {
  private session: ort.InferenceSession | null = null;
  private tokenizer: any;
  private vocab: Map<string, number> = new Map();
  private specialTokens: Map<string, number> = new Map();
  private initialized = false;
  
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing DirectMiniLMEmbeddings...');
      
      // 1. ONNXモデルを読み込み
      const modelPath = path.join(process.cwd(), 'models', 'all-MiniLM-L6-v2', 'models', 'all-MiniLM-L6-v2', 'model.onnx');
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }
      
      this.session = await ort.InferenceSession.create(modelPath);
      logger.info(`ONNX model loaded from: ${modelPath}`);
      
      // 2. トークナイザー設定を読み込み
      const tokenizerPath = path.join(process.cwd(), 'models', 'all-MiniLM-L6-v2', 'models', 'all-MiniLM-L6-v2', 'tokenizer.json');
      if (!fs.existsSync(tokenizerPath)) {
        throw new Error(`Tokenizer file not found: ${tokenizerPath}`);
      }
      
      const tokenizerData = fs.readFileSync(tokenizerPath, 'utf8');
      this.tokenizer = JSON.parse(tokenizerData);
      
      // 3. 語彙を構築
      this.buildVocabulary();
      
      this.initialized = true;
      logger.info('DirectMiniLMEmbeddings initialized successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize DirectMiniLMEmbeddings: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * テキストを384次元の埋め込みベクトルに変換
   */
  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.session) {
      throw new Error('DirectMiniLMEmbeddings not initialized');
    }
    
    try {
      // 1. テキストをトークン化
      const tokens = this.tokenize(text);
      const inputIds = this.tokensToIds(tokens);
      const attentionMask = new Array(inputIds.length).fill(1);
      
      // シーケンス長を制限（BERTの最大長512）
      const maxLength = Math.min(inputIds.length, 512);
      const truncatedInputIds = inputIds.slice(0, maxLength);
      const truncatedAttentionMask = attentionMask.slice(0, maxLength);
      
      // 2. ONNX推論実行
      const tokenTypeIds = new Array(maxLength).fill(0); // すべて0の token_type_ids
      const feeds = {
        'input_ids': new ort.Tensor('int64', new BigInt64Array(truncatedInputIds.map(id => BigInt(id))), [1, maxLength]),
        'attention_mask': new ort.Tensor('int64', new BigInt64Array(truncatedAttentionMask.map(mask => BigInt(mask))), [1, maxLength]),
        'token_type_ids': new ort.Tensor('int64', new BigInt64Array(tokenTypeIds.map(id => BigInt(id))), [1, maxLength])
      };
      
      const results = await this.session.run(feeds);
      const embeddings = results.last_hidden_state.data as Float32Array;
      
      // 3. 平均プーリング + 正規化
      const pooled = this.meanPooling(embeddings, truncatedAttentionMask, maxLength);
      const normalized = this.normalize(pooled);
      
      return Array.from(normalized);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create embedding: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * セマンティック検索：クエリと複数のテキストブロックの類似度計算
   */
  async findSemanticMatches(
    textBlocks: string[],
    query: string,
    threshold: number = 0.7
  ): Promise<Array<{index: number, score: number}>> {
    
    if (!this.initialized) {
      throw new Error('DirectMiniLMEmbeddings not initialized');
    }
    
    try {
      // クエリの埋め込みベクトル
      const queryEmbedding = await this.embed(query);
      
      const matches: Array<{index: number, score: number}> = [];
      
      // 各テキストブロックとの類似度計算
      for (let i = 0; i < textBlocks.length; i++) {
        const blockEmbedding = await this.embed(textBlocks[i]);
        const similarity = this.cosineSimilarity(queryEmbedding, blockEmbedding);
        
        if (similarity >= threshold) {
          matches.push({ index: i, score: similarity });
        }
      }
      
      return matches.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to find semantic matches: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * 語彙構築
   */
  private buildVocabulary(): void {
    if (!this.tokenizer.model || !this.tokenizer.model.vocab) {
      throw new Error('Invalid tokenizer format: missing vocab');
    }
    
    // 語彙マップ構築
    const vocab = this.tokenizer.model.vocab;
    Object.entries(vocab).forEach(([token, id]) => {
      this.vocab.set(token, id as number);
    });
    
    // 特殊トークン設定
    this.specialTokens.set('[PAD]', this.vocab.get('[PAD]') || 0);
    this.specialTokens.set('[UNK]', this.vocab.get('[UNK]') || 100);
    this.specialTokens.set('[CLS]', this.vocab.get('[CLS]') || 101);
    this.specialTokens.set('[SEP]', this.vocab.get('[SEP]') || 102);
    
    logger.info(`Vocabulary built with ${this.vocab.size} tokens`);
  }
  
  /**
   * 簡易トークナイザー（完全なBPE実装は複雑なので基本版）
   */
  private tokenize(text: string): string[] {
    // 前処理
    const cleanText = text
      .toLowerCase()
      .replace(/[^\w\s.-]/g, ' ')  // 記号を空白に
      .replace(/\s+/g, ' ')       // 複数空白を単一空白に
      .trim();
    
    // 基本的な単語分割
    const words = cleanText.split(' ').filter(word => word.length > 0);
    
    const tokens: string[] = ['[CLS]'];  // 開始トークン
    
    words.forEach(word => {
      // 既知の単語かチェック
      if (this.vocab.has(word)) {
        tokens.push(word);
      } else {
        // 未知語は文字レベルで分割（簡易版）
        const chars = word.split('').map(char => `##${char}`);
        tokens.push(...chars);
      }
    });
    
    tokens.push('[SEP]');  // 終了トークン
    
    return tokens;
  }
  
  /**
   * トークンをIDに変換
   */
  private tokensToIds(tokens: string[]): number[] {
    return tokens.map(token => {
      return this.vocab.get(token) || this.specialTokens.get('[UNK]') || 100;
    });
  }
  
  /**
   * 平均プーリング
   */
  private meanPooling(embeddings: Float32Array, attentionMask: number[], seqLength: number): Float32Array {
    const hiddenSize = 384;  // all-MiniLM-L6-v2の次元数
    
    if (embeddings.length !== seqLength * hiddenSize) {
      throw new Error(`Embedding shape mismatch: expected ${seqLength * hiddenSize}, got ${embeddings.length}`);
    }
    
    const result = new Float32Array(hiddenSize);
    let sumMask = 0;
    
    for (let i = 0; i < seqLength; i++) {
      if (attentionMask[i]) {
        for (let j = 0; j < hiddenSize; j++) {
          result[j] += embeddings[i * hiddenSize + j];
        }
        sumMask++;
      }
    }
    
    // 平均化
    if (sumMask > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        result[j] /= sumMask;
      }
    }
    
    return result;
  }
  
  /**
   * ベクトル正規化
   */
  private normalize(vector: Float32Array): Float32Array {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (norm === 0) {
      return vector;
    }
    
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / norm;
    }
    
    return normalized;
  }
  
  /**
   * コサイン類似度計算（正規化済みベクトル前提）
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    // 正規化済みベクトルなので内積がコサイン類似度
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    return Math.max(0, Math.min(1, dotProduct)); // 0-1の範囲にクリップ
  }
  
  /**
   * 初期化状態を確認
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * リソースクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.initialized = false;
    logger.info('DirectMiniLMEmbeddings cleaned up');
  }
}