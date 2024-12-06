import fs from 'fs';
import path from 'path';

type FindConfigDirOptions = {
  ignoreDirs: string[];
};

const findDir = (
  startPath: string,
  foldername: string,
  options?: FindConfigDirOptions,
): string | null => {
  const directories = fs.readdirSync(startPath, { withFileTypes: true });
  for (const dirent of directories) {
    if (dirent.isDirectory() && !options?.ignoreDirs.includes(dirent.name)) {
      const configPath = path.join(startPath, dirent.name, foldername);
      if (fs.existsSync(configPath) && fs.statSync(configPath).isDirectory()) {
        return configPath;
      }
      const nestedConfigPath = findDir(
        path.join(startPath, dirent.name),
        foldername,
        options,
      );
      if (nestedConfigPath) {
        return nestedConfigPath;
      }
    }
  }
  return null;
};

export { findDir };
