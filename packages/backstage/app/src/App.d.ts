import { FrontendFeature } from '@backstage/frontend-plugin-api';
interface BuildAppOptions {
    TargetPlugin: FrontendFeature;
}
export declare function buildDevApp({ TargetPlugin }: BuildAppOptions): {
    createRoot(): import("react").JSX.Element;
};
export {};
//# sourceMappingURL=App.d.ts.map