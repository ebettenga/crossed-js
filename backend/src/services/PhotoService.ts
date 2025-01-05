import sharp from 'sharp';

export class PhotoService {
  private readonly maxWidth = 800;
  private readonly maxHeight = 800;
  private readonly quality = 80;

  async processPhoto(file: Buffer): Promise<Buffer> {
    // Process image with sharp
    return await sharp(file)
      .resize(this.maxWidth, this.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: this.quality })
      .toBuffer();
  }
} 