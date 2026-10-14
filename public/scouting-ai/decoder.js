/** Fixed, same-origin model registry. No caller-supplied path or remote URL. */
const models = Object.freeze({
  v2b: Object.freeze({ file: './model.onnx', width: 768, height: 432, frames: 9, family: 'grid', output: Object.freeze([1, 36, 27, 48]) }),
  v4c: Object.freeze({ file: './model-v4c.onnx', width: 512, height: 288, frames: 9, family: 'heatmap', output: Object.freeze([1, 18, 288, 512]) }),
});

export function trackingModel(model = 'v2b') {
  if (typeof model !== 'string' || !Object.hasOwn(models, model)) throw new Error('Modelo de tracking não suportado.');
  return models[model];
}

const missing = score => ({ score, x: NaN, y: NaN });
const validScore = score => Number.isFinite(score) && score >= 0 && score <= 1;

function gridPredictions(values) {
  const size = 27 * 48, predictions = [];
  for (let frame = 0; frame < 9; frame++) {
    const offset = frame * 4 * size;
    let best = -1;
    for (let i = 0; i < size; i++) {
      const score = values[offset + i];
      if (validScore(score) && (best < 0 || score > values[offset + best])) best = i;
    }
    if (best < 0) { predictions.push(missing(0)); continue; }
    const score = values[offset + best];
    const dx = values[offset + size + best], dy = values[offset + 2 * size + best];
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx < 0 || dx > 1 || dy < 0 || dy > 1) {
      predictions.push(missing(score)); continue;
    }
    predictions.push({ score, x: (best % 48 + dx) / 48, y: (Math.floor(best / 48) + dy) / 27 });
  }
  return predictions;
}

/** Largest 8-connected region above threshold; center is its raster centroid. */
function heatmapPredictions(values, threshold) {
  const width = 512, height = 288, size = width * height, predictions = [];
  const visited = new Uint8Array(size), queue = new Int32Array(size);
  for (let frame = 0; frame < 9; frame++) {
    visited.fill(0);
    const offset = frame * size;
    let score = 0, regionScore = 0, largest = 0, centerX = 0, centerY = 0;
    for (let index = 0; index < size; index++) {
      const value = values[offset + index];
      if (validScore(value)) score = Math.max(score, value);
      if (visited[index] || !validScore(value) || value < threshold) continue;
      let head = 0, tail = 1, sumX = 0, sumY = 0, peak = 0;
      queue[0] = index; visited[index] = 1;
      while (head < tail) {
        const point = queue[head++], x = point % width, y = Math.floor(point / width);
        sumX += x; sumY += y; peak = Math.max(peak, values[offset + point]);
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            const neighbor = ny * width + nx, candidate = values[offset + neighbor];
            if (!visited[neighbor] && validScore(candidate) && candidate >= threshold) {
              visited[neighbor] = 1; queue[tail++] = neighbor;
            }
          }
        }
      }
      if (tail > largest) { largest = tail; centerX = sumX / tail; centerY = sumY / tail; regionScore = peak; }
    }
    // Omit tiny singleton noise rather than creating an observed trajectory.
    predictions.push(largest >= 4 ? { score: regionScore, x: centerX / width, y: centerY / height } : missing(score));
  }
  return predictions;
}

export function decodeTrackingOutput(model, values, dimensions, threshold = .5) {
  const config = trackingModel(model);
  if (!(values instanceof Float32Array) || !Array.isArray(dimensions)
    || dimensions.length !== 4 || dimensions.some((dimension, index) => dimension !== config.output[index])
    || values.length !== config.output.reduce((length, size) => length * size, 1)) {
    throw new Error('Formato inesperado na saída do modelo de tracking.');
  }
  if (!validScore(threshold) || threshold === 0) throw new Error('Limiar de tracking inválido.');
  return config.family === 'grid' ? gridPredictions(values) : heatmapPredictions(values, threshold);
}
