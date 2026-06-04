'use strict';

const fs = require('fs').promises;
const path = require('path');

const isLocalFileUrl = (fileUrl) =>
  typeof fileUrl === 'string' && fileUrl.trim() &&
  !/^https?:\/\//i.test(fileUrl) &&
  !/^blob:/i.test(fileUrl);

const resolveStorageRoot = (env = process.env) =>
  env.ATTACHMENT_STORAGE_ROOT
    ? path.resolve(env.ATTACHMENT_STORAGE_ROOT)
    : path.resolve(process.cwd(), 'attachments');

const resolveAttachmentPath = (fileUrl, storageRoot) =>
  path.isAbsolute(fileUrl) ? fileUrl : path.resolve(storageRoot, fileUrl);

const listFilesRecursive = async (root) => {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const normalizePath = (value) => path.normalize(value);

const reconcileAttachmentStorage = async (attachments, options = {}) => {
  const storageRoot = options.storageRoot || resolveStorageRoot();

  const localAttachments = attachments
    .filter((entry) => isLocalFileUrl(entry.fileUrl))
    .map((entry) => ({
      id: entry.ID,
      fileName: entry.fileName,
      fileUrl: String(entry.fileUrl).trim(),
      resolvedPath: resolveAttachmentPath(String(entry.fileUrl).trim(), storageRoot),
    }));

  const missingAttachments = [];
  const referencedPaths = new Set();

  for (const attachment of localAttachments) {
    referencedPaths.add(normalizePath(attachment.resolvedPath));
    try {
      await fs.access(attachment.resolvedPath);
    } catch {
      missingAttachments.push(attachment);
    }
  }

  let orphanFiles = [];
  try {
    const storageFiles = await listFilesRecursive(storageRoot);
    orphanFiles = storageFiles.filter((filePath) => !referencedPaths.has(normalizePath(filePath)));
  } catch {
    orphanFiles = [];
  }

  return {
    storageRoot,
    missingAttachments,
    orphanFiles,
  };
};

module.exports = {
  reconcileAttachmentStorage,
  resolveStorageRoot,
};
