// textrank.js
// Simple in-browser TextRank summarizer (TF-IDF + PageRank over sentence graph).
// Exposes window.TextRankSummarizer.summarize(text, options)

(function () {
  // Basic English stopwords (small but useful)
  const STOPWORDS = new Set((
    "a,about,above,after,again,against,all,am,an,and,any,are,as,at,be,because,been,before," +
    "being,below,between,both,but,by,could,did,do,does,doing,down,during,each,few,for,from," +
    "further,had,has,have,having,he,her,here,hers,him,himself,his,how,i,if,in,into,is,it," +
    "its,itself,just,me,more,most,my,myself,no,nor,not,now,of,off,on,once,only,or,other,our," +
    "ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs,them," +
    "themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we," +
    "were,what,when,where,which,while,who,whom,why,will,with,you,your,yours,yourself,yourselves"
  ).split(","));

  // Split text into sentences (reasonable heuristic)
  function splitSentences(text) {
    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();
    if (!text) return [];
    // Split on sentence-ending punctuation followed by a space and capital letter or EOL
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
    // Trim sentences
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  // Tokenize a sentence into words (lowercase, remove punctuation)
  function tokenizeWords(sentence) {
    const words = sentence
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // normalize quotes
      .replace(/[^a-z0-9'\s]/g, " ") // remove punctuation (allow apostrophes)
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOPWORDS.has(w));
    return words;
  }

  // Build TF vectors for sentences and compute IDF
  function buildTfIdf(sentences) {
    const docsTokens = sentences.map(s => tokenizeWords(s));
    const N = docsTokens.length;
    const df = {}; // document frequency per term
    const tfVectors = []; // array of {term: tf}

    for (let tokens of docsTokens) {
      const tf = {};
      const seen = new Set();
      for (let w of tokens) {
        tf[w] = (tf[w] || 0) + 1;
        if (!seen.has(w)) {
          df[w] = (df[w] || 0) + 1;
          seen.add(w);
        }
      }
      tfVectors.push(tf);
    }

    // compute idf
    const idf = {};
    for (let term in df) {
      idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1; // smoothed idf
    }

    // build normalized tf-idf vectors as plain object maps
    const vectors = tfVectors.map(tf => {
      const vec = {};
      for (let term in tf) {
        vec[term] = tf[term] * (idf[term] || 0);
      }
      return vec;
    });

    return { vectors, idf };
  }

  // Cosine similarity between sparse vectors (objects)
  function cosineSim(a, b) {
    // a and b are {term: value}
    let dot = 0, na = 0, nb = 0;
    for (let k in a) {
      na += a[k] * a[k];
      if (b[k]) dot += a[k] * b[k];
    }
    for (let k in b) {
      nb += b[k] * b[k];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // Build similarity matrix (NxN)
  function buildSimilarityMatrix(vectors) {
    const N = vectors.length;
    const sim = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const s = cosineSim(vectors[i], vectors[j]);
        sim[i][j] = s;
        sim[j][i] = s;
      }
    }
    return sim;
  }

  // Run PageRank on the similarity graph
  function pageRank(similarityMatrix, options = {}) {
    const d = (options.damping !== undefined) ? options.damping : 0.85;
    const maxIter = options.maxIter || 100;
    const tol = options.tolerance || 1e-4;
    const N = similarityMatrix.length;
    if (N === 0) return [];

    // Build weighted outgoing sums
    const scores = new Array(N).fill(1 / N);
    const outSum = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += similarityMatrix[i][j];
      outSum[i] = s;
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const newScores = new Array(N).fill((1 - d) / N);
      let diff = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (similarityMatrix[j][i] === 0) continue;
          const w = similarityMatrix[j][i];
          const denom = outSum[j] === 0 ? N : outSum[j];
          newScores[i] += d * (w / denom) * scores[j];
        }
      }
      for (let i = 0; i < N; i++) {
        diff += Math.abs(newScores[i] - scores[i]);
        scores[i] = newScores[i];
      }
      if (diff < tol) break;
    }

    return scores;
  }

  // Main summarize function
  function summarize(text, options = {}) {
    options = Object.assign({
      // default options
      numSentences: 3,
      ratio: null,           // alternative: fraction of sentences to return (overrides numSentences if set)
      minSentenceLength: 10, // ignore tiny sentences (characters)
      similarityThreshold: 0.0 // we include all edges but PageRank weights them; threshold can be >0 to sparsify
    }, options);

    if (!text || typeof text !== "string") return "";

    // Split into sentences
    const sentences = splitSentences(text).filter(s => s.length >= options.minSentenceLength);
    if (sentences.length === 0) return "";

    // If only 1 sentence, return it
    if (sentences.length === 1) return sentences[0];

    // Build TF-IDF vectors
    const { vectors } = buildTfIdf(sentences);

    // Build similarity matrix
    let sim = buildSimilarityMatrix(vectors);

    // Optionally threshold small similarities to zero (sparsify)
    if (options.similarityThreshold > 0) {
      for (let i = 0; i < sim.length; i++) {
        for (let j = 0; j < sim.length; j++) {
          if (sim[i][j] < options.similarityThreshold) sim[i][j] = 0;
        }
      }
    }

    // PageRank
    const scores = pageRank(sim, { damping: 0.85, maxIter: 100, tolerance: 1e-6 });

    // Choose top-k sentences
    const N = sentences.length;
    let k;
    if (options.ratio && options.ratio > 0 && options.ratio < 1) {
      k = Math.max(1, Math.round(N * options.ratio));
    } else {
      k = Math.min(N, Math.max(1, options.numSentences));
    }

    // Get indices sorted by score desc
    const idx = scores.map((s, i) => ({ i, s }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map(o => o.i);

    // Order them by original position to keep coherence
    idx.sort((a, b) => a - b);

    const summary = idx.map(i => sentences[i]).join(" ");
    return summary;
  }

  // Expose to global
  window.TextRankSummarizer = {
    summarize
  };
})();
