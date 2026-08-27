export const H0_SPIKE_ID = "ripple-graph-spike-v1";
export const H0_SPIKE_LABEL = "RippleGraphSpike";
export const H0_SPIKE_NAMESPACE = "__ripple_h0_spike__";

export const H0_SPIKE_VERSIONS = {
  appA: `${H0_SPIKE_NAMESPACE}/app-a@1.0.0`,
  appB: `${H0_SPIKE_NAMESPACE}/app-b@2.0.0`,
  debug: `${H0_SPIKE_NAMESPACE}/debug@4.4.1`,
  express: `${H0_SPIKE_NAMESPACE}/express@5.1.0`,
  koa: `${H0_SPIKE_NAMESPACE}/koa@3.0.0`,
} as const;

export const H0_SPIKE_PACKAGES = {
  appA: `${H0_SPIKE_NAMESPACE}/app-a`,
  appB: `${H0_SPIKE_NAMESPACE}/app-b`,
  debug: `${H0_SPIKE_NAMESPACE}/debug`,
  express: `${H0_SPIKE_NAMESPACE}/express`,
  koa: `${H0_SPIKE_NAMESPACE}/koa`,
} as const;
