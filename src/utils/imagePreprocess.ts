const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for preprocessing"));
    image.src = src;
  });

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const percentileValue = (histogram: Uint32Array, total: number, percentile: number) => {
  const target = total * percentile;
  let running = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    running += histogram[i];
    if (running >= target) {
      return i;
    }
  }
  return histogram.length - 1;
};

export async function preprocessBloodworkImage(
  base64Image: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const image = await loadImageElement(dataUrl);

  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error("Canvas context not available for preprocessing");
  }

  sourceContext.drawImage(image, 0, 0, width, height);
  const imageData = sourceContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const histogram = new Uint32Array(256);

  for (let i = 0; i < pixels.length; i += 4) {
    const gray = clampChannel(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    histogram[gray] += 1;
  }

  const totalPixels = width * height;
  const lower = percentileValue(histogram, totalPixels, 0.01);
  const upper = percentileValue(histogram, totalPixels, 0.99);
  const spread = Math.max(1, upper - lower);

  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    const normalized = ((gray - lower) * 255) / spread;
    const boosted = clampChannel(normalized * 1.08);
    pixels[i] = boosted;
    pixels[i + 1] = boosted;
    pixels[i + 2] = boosted;
  }

  sourceContext.putImageData(imageData, 0, 0);

  // Apply a light sharpen pass so blurred phone-photo digits separate more clearly.
  const sharpenedCanvas = document.createElement("canvas");
  sharpenedCanvas.width = width;
  sharpenedCanvas.height = height;
  const sharpenedContext = sharpenedCanvas.getContext("2d", { willReadFrequently: true });
  if (!sharpenedContext) {
    throw new Error("Canvas context not available for sharpen pass");
  }

  sharpenedContext.drawImage(sourceCanvas, 0, 0);
  const sharpenedData = sharpenedContext.getImageData(0, 0, width, height);
  const output = sharpenedData.data;
  const input = new Uint8ClampedArray(output);

  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let value = 0;
      let kernelIndex = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const offset = ((y + ky) * width + (x + kx)) * 4;
          value += input[offset] * kernel[kernelIndex];
          kernelIndex += 1;
        }
      }

      const outputOffset = (y * width + x) * 4;
      const sharpened = clampChannel(value);
      output[outputOffset] = sharpened;
      output[outputOffset + 1] = sharpened;
      output[outputOffset + 2] = sharpened;
      output[outputOffset + 3] = 255;
    }
  }

  sharpenedContext.putImageData(sharpenedData, 0, 0);
  const processedDataUrl = sharpenedCanvas.toDataURL("image/jpeg", 0.95);
  return {
    mimeType: "image/jpeg",
    base64: processedDataUrl.split(",")[1]
  };
}

export interface VerticalCropBand {
  top: number;
  bottom: number;
}

export async function createBloodworkFocusCrop(
  base64Image: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string } | null> {
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const image = await loadImageElement(dataUrl);

  if (image.width < 420 || image.height < 420) {
    return null;
  }

  const left = Math.floor(image.width * 0.08);
  const right = Math.ceil(image.width * 0.92);
  const top = Math.floor(image.height * 0.2);
  const bottom = Math.ceil(image.height * 0.9);
  const cropWidth = Math.max(1, right - left);
  const cropHeight = Math.max(1, bottom - top);

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context not available for focus crop");
  }

  context.drawImage(
    image,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const cropDataUrl = canvas.toDataURL("image/jpeg", 0.95);
  return {
    mimeType: "image/jpeg",
    base64: cropDataUrl.split(",")[1]
  };
}

export async function cropImageBands(
  base64Image: string,
  mimeType: string,
  bands: VerticalCropBand[]
): Promise<Array<{ base64: string; mimeType: string }>> {
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const image = await loadImageElement(dataUrl);
  const safeBands = bands
    .map((band) => ({
      top: Math.max(0, Math.min(image.height - 1, Math.floor(band.top))),
      bottom: Math.max(1, Math.min(image.height, Math.ceil(band.bottom)))
    }))
    .filter((band) => band.bottom - band.top >= 24);

  const crops: Array<{ base64: string; mimeType: string }> = [];
  for (const band of safeBands) {
    const cropHeight = band.bottom - band.top;
    const scale = Math.min(3.4, Math.max(1.4, 340 / cropHeight));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(cropHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context not available for crop generation");
    }

    context.drawImage(
      image,
      0,
      band.top,
      image.width,
      cropHeight,
      0,
      0,
      width,
      height
    );

    const cropDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    crops.push({
      mimeType: "image/jpeg",
      base64: cropDataUrl.split(",")[1]
    });
  }

  return crops;
}
