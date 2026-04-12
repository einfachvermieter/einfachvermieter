import {
  CostEntryAttachmentSchema,
  CostEntrySchema,
} from "@einfachvermieter/db";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  attachmentMaxBytesFromEnv,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, NotFoundException } from "@nestjs/common";
import { assertUploadAllowed } from "../common/upload-guard.js";
import { notFoundMessage } from "../i18n/notFound.js";
import {
  StorageService,
  storageKeyForCostEntryAttachment,
} from "../storage/storage.service.js";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_ATTACHMENT_MIME_TYPES);

const MAX_ATTACHMENT_BYTES = attachmentMaxBytesFromEnv(process.env);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const LIST_FIELDS = [
  "id",
  "costEntryId",
  "originalFilename",
  "mimeType",
  "sizeBytes",
  "createdAt",
] as const;

type UploadInput = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  /**
   * Optionaler OCR-Text, von Neuanlage aus einer vorherigen
   * KI-Extraktion mitgegeben. Wird direkt in die neue Anhangs-Zeile
   * geschrieben.
   */
  ocrText?: string;
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: StorageService,
  ) {}

  /**
   * Anhangs-Metadaten einer Rechnung auflisten (ohne Datei-Inhalt)
   */
  list(costEntryId: string) {
    return this.em.find(
      CostEntryAttachmentSchema,
      { costEntryId },
      { orderBy: { createdAt: "asc" }, fields: [...LIST_FIELDS] },
    );
  }

  /**
   * Datei zu einer Rechnung hochladen. Prüft MIME-Typ und Größe
   */
  async upload(costEntryId: string, file: UploadInput) {
    assertUploadAllowed(
      file.mimetype,
      file.size,
      ALLOWED_MIME_SET,
      MAX_ATTACHMENT_BYTES,
    );

    const entry = await this.em.findOne(
      CostEntrySchema,
      { id: costEntryId },
      { fields: ["id"] },
    );
    if (!entry) {
      throw new NotFoundException(notFoundMessage("costEntry", costEntryId));
    }

    const id = crypto.randomUUID();
    const extension = MIME_TO_EXT[file.mimetype] ?? "bin";
    const storageKey = storageKeyForCostEntryAttachment(
      costEntryId,
      id,
      extension,
    );

    await this.storage.write(storageKey, file.buffer);

    try {
      const created = this.em.create(CostEntryAttachmentSchema, {
        id,
        costEntryId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        ocrText: file.ocrText?.trim() ? file.ocrText : null,
      });

      this.em.persist(created);
      await this.em.flush();

      return {
        id: created.id,
        costEntryId: created.costEntryId,
        originalFilename: created.originalFilename,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
        createdAt: created.createdAt,
      };
    } catch (error) {
      // DB-Insert fehlgeschlagen -> Datei wieder entfernen
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Anhang samt Datei-Inhalt aus dem Storage laden
   */
  async loadFile(costEntryId: string, attachmentId: string) {
    const attachment = await this.em.findOne(CostEntryAttachmentSchema, {
      id: attachmentId,
      costEntryId,
    });

    if (!attachment) {
      throw new NotFoundException(
        notFoundMessage("costEntryAttachment", attachmentId),
      );
    }

    const data = await this.storage.read(attachment.storageKey);

    return { attachment, data };
  }

  /**
   * OCR-Text eines Anhangs nachtragen (z.B. nach späterer KI-Extraktion)
   */
  async setOcrText(attachmentId: string, ocrText: string): Promise<void> {
    await this.em.nativeUpdate(
      CostEntryAttachmentSchema,
      { id: attachmentId },
      { ocrText },
    );
  }

  /**
   * Anhang löschen: DB und Blob Storage
   */
  async delete(costEntryId: string, attachmentId: string) {
    const attachment = await this.em.findOne(CostEntryAttachmentSchema, {
      id: attachmentId,
      costEntryId,
    });

    if (!attachment) {
      throw new NotFoundException(
        notFoundMessage("costEntryAttachment", attachmentId),
      );
    }

    const { storageKey } = attachment;
    this.em.remove(attachment);

    await this.em.flush();
    await this.storage.delete(storageKey).catch(() => undefined);

    return { id: attachmentId };
  }
}
