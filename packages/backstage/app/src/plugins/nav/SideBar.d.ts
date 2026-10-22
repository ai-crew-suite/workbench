import { type NavContentComponent } from '@backstage/plugin-app-react';
export declare const customSidebarExtension: import("@backstage/frontend-plugin-api").OverridableExtensionDefinition<{
    kind: "nav-content";
    name: "custom-sidebar-menu";
    config: {};
    configInput: {};
    output: import("@backstage/frontend-plugin-api").ExtensionDataRef<NavContentComponent, "core.nav-content.component", {}>;
    inputs: {};
    params: {
        component: NavContentComponent;
    };
}>;
export declare const customNavModule: import("@backstage/frontend-plugin-api").FrontendModule;
//# sourceMappingURL=SideBar.d.ts.map