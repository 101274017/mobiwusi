const { ObservationError, checkGeometry, pngDimensions } = require('./observation-common.cjs');

function validateObservationRegion(region, width, height) {
  if (region === undefined || region === null) return null;
  if (typeof region !== 'object' || Array.isArray(region) || Object.keys(region).length !== 4
    || !['x', 'y', 'width', 'height'].every(key => Object.hasOwn(region, key) && Number.isSafeInteger(region[key]))
    || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1
    || region.x + region.width > width || region.y + region.height > height) throw new ObservationError('capture_region_invalid');
  return Object.freeze({ x: region.x, y: region.y, width: region.width, height: region.height });
}

function cropObservationPng(png, geometry, selection, nativeImage, limits) {
  const region = validateObservationRegion(selection, geometry.width, geometry.height);
  if (!region || typeof nativeImage?.createFromBuffer !== 'function' || typeof nativeImage?.createFromBitmap !== 'function') throw new ObservationError('capture_region_unavailable');
  const image = nativeImage.createFromBuffer(png);
  if (!image || image.isEmpty()) throw new ObservationError('capture_region_unavailable');
  const size = image.getSize(1);
  if (size.width !== geometry.pixelWidth || size.height !== geometry.pixelHeight) throw new ObservationError('capture_dimensions_unproven');
  const pixelX = Math.round(region.x * geometry.scaleFactor);
  const pixelY = Math.round(region.y * geometry.scaleFactor);
  const width = Math.min(Math.round(region.width * geometry.scaleFactor), size.width - pixelX);
  const height = Math.min(Math.round(region.height * geometry.scaleFactor), size.height - pixelY);
  if (width < 1 || height < 1) throw new ObservationError('capture_region_invalid');
  const croppedGeometry = checkGeometry({ ...geometry, x: geometry.x + region.x, y: geometry.y + region.y,
    width: region.width, height: region.height, pixelX: geometry.pixelX + pixelX, pixelY: geometry.pixelY + pixelY,
    pixelWidth: width, pixelHeight: height }, width, height);
  let originalBitmap;
  let bitmap;
  let croppedPng;
  let returned = false;
  try {
    originalBitmap = image.toBitmap({ scaleFactor: 1 });
    if (!Buffer.isBuffer(originalBitmap) || originalBitmap.length !== size.width * size.height * 4) throw new ObservationError('capture_dimensions_unproven');
    bitmap = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      const start = ((pixelY + row) * size.width + pixelX) * 4;
      originalBitmap.copy(bitmap, row * width * 4, start, start + width * 4);
    }
    const cropped = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 1 });
    if (!cropped || cropped.isEmpty()) throw new ObservationError('capture_region_unavailable');
    croppedPng = cropped.toPNG({ scaleFactor: 1 });
    const dimensions = pngDimensions(croppedPng, limits);
    if (dimensions.width !== width || dimensions.height !== height) throw new ObservationError('capture_dimensions_unproven');
    returned = true;
    return { png: croppedPng, width, height, geometry: croppedGeometry };
  } finally {
    if (Buffer.isBuffer(originalBitmap)) originalBitmap.fill(0);
    bitmap?.fill(0);
    if (!returned && Buffer.isBuffer(croppedPng)) croppedPng.fill(0);
  }
}

module.exports = { validateObservationRegion, cropObservationPng };
