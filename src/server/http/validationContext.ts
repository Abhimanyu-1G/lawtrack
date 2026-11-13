import 'server-only';

import type { Clock } from '../lib/clock';
import type { Repositories } from '../db/repositories';
import type { ValidationContext } from '../../shared/validation';
import type { Locale } from '../../i18n';

/**
 * Repository-backed validation context (AGENTS.md §5). Validators stay pure;
 * this adapter supplies the async existence/uniqueness probes services need.
 */
export function createValidationContext(
  repos: Repositories,
  clock: Clock,
  locale: Locale,
): ValidationContext {
  return {
    clock,
    locale,

    async exists(table, id) {
      if (table === 'Citizen') {
        return (await repos.users.findCitizen(id)) !== undefined;
      }
      return (await repos.integrations.findById(id)) !== undefined;
    },

    async isUnique(field, value) {
      if (field === 'email') {
        return (await repos.users.findByEmail(value)) === undefined;
      }
      // CNR uniqueness is checked by the cases service until that repo lands.
      return true;
    },
  };
}
