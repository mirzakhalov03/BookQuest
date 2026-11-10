import type { Request, Response } from 'express';
import * as interactionService from '../../services/interaction.services.js';
import type {
  AdminInteractionFacetsQuery,
  AdminInteractionQuery
} from '../../validators/admin.validators.js';
import { auditAdmin } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

// Paging and display settings, not filters: left out of the audit line.
const NOT_FILTERS = new Set(['cursor', 'since', 'limit', 'order', 'view', 'includeAdmins']);

/** GET /api/v1/admin/interactions */
export async function listInteractions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as AdminInteractionQuery;
  // First page only: load-more and the 30 s poll would otherwise audit every half minute.
  if (!query.cursor && !query.since) {
    const filterKeys = Object.entries(query).flatMap(([key, value]) =>
      value !== undefined && !NOT_FILTERS.has(key) ? [key] : []
    );
    auditAdmin(req, 'interactions.list', { view: query.view, filterKeys });
  }
  ok(res, await interactionService.listInteractions(query));
}

/** GET /api/v1/admin/interactions/facets */
export async function getFacets(req: Request, res: Response): Promise<void> {
  ok(res, await interactionService.getFacets(req.query as unknown as AdminInteractionFacetsQuery));
}
