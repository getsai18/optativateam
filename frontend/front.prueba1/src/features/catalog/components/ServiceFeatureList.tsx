import { useI18n } from '../../../shared/i18n';
import type { Feature, Service } from '../../../shared/types';

/** Read-only list of a service's features with their values and units. */
export function ServiceFeatureList({ service, features }: { service: Service; features: Feature[] }) {
  const { t } = useI18n();
  const byId = new Map(features.map((f) => [f.id, f]));
  if (service.features.length === 0) {
    return <p className="text-sm text-muted">{t('catalog.services.readonly.noFeatures')}</p>;
  }
  return (
    <dl className="divide-y divide-line rounded-control border border-line">
      {service.features.map(({ featureId, value }) => {
        const feature = byId.get(featureId);
        return (
          <div key={featureId} className="flex items-start justify-between gap-4 px-3 py-2">
            <div>
              <dt className="text-sm text-ink">{feature?.name ?? featureId}</dt>
              {feature?.description ? <p className="text-sm text-muted">{feature.description}</p> : null}
            </div>
            <dd className="shrink-0 text-right font-mono text-sm tabular-nums">
              {value}
              {feature?.unit ? <span className="ml-1 text-sm text-muted">{feature.unit}</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
