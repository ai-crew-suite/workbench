/**
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { NavContentBlueprint, type NavContentComponent } from '@backstage/plugin-app-react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip from '@mui/material/Tooltip';
import { Search as SearchIcon, Help as HelpIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { SidebarLogo } from './SideBarLogo';

/**
 * Fixed 72px custom sidebar rail. Mirrors the positioning strategy of
 * Backstage's legacy `Sidebar` (a fixed-position permanent drawer): being
 * out of flow lets the page content start at the top of the viewport
 * instead of stacking below the rail, while the layout's `SidebarPage`
 * reserves a matching 72px gutter (see the GlobalStyles override in
 * App.tsx). It never collapses to a wide drawer variant.
 */
const CustomSidebarNav: NavContentComponent = ({ navItems }) => {
  // Remove layout-managed entries we render (or hide) ourselves.
  navItems.take('page:search');
  navItems.take('page:notifications');
  navItems.take('plugin:notifications');
  navItems.take('page:app-visualizer');
  navItems.take('page:user-settings');

  const coreCatalog = navItems.take('page:catalog');
  const coreScaffolder = navItems.take('page:scaffolder');
  const runtimeExtensions = navItems.rest();

  const isOpen = false;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: theme => theme.zIndex.drawer,
        width: 72,
        minWidth: 72,
        maxWidth: 72,
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowX: 'hidden',
        py: 2,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        <SidebarLogo isOpen={isOpen} />
      </Box>

      {/* Core Menu Lists */}
      <List sx={{ width: '100%', mt: 2, px: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ListItem disablePadding>
          <Tooltip title="Search" placement="right">
            <ListItemButton component={RouterLink} to="/search" sx={{ borderRadius: 1, minHeight: 48, px: 0, justifyContent: 'center', width: '100%' }}>
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center' }}>
                <SearchIcon color="primary" sx={{ fontSize: 32 }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>

        <Divider sx={{ my: 1, mx: 1 }} />

        {/* Catalog Item Button */}
        {coreCatalog && (
          <ListItem disablePadding>
            <Tooltip title={coreCatalog.title} placement="right">
              {/* Force the real browser routing path */}
              <ListItemButton component={RouterLink} to="/catalog" sx={{ borderRadius: 1, minHeight: 48, px: 0, justifyContent: 'center', width: '100%' }}>
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'text.secondary' }}>
                  {coreCatalog.icon ? (
                    <Box sx={{ display: 'flex', '& svg': { fontSize: 32 } }}>{coreCatalog.icon}</Box>
                  ) : (
                    <HelpIcon sx={{ fontSize: 32 }} />
                  )}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* Scaffolder Item Button */}
        {coreScaffolder && (
          <ListItem disablePadding>
            <Tooltip title={coreScaffolder.title} placement="right">
              {/* Backstage Alpha Scaffolder mounts dynamically onto /create instead of /scaffolder */}
              <ListItemButton component={RouterLink} to="/create" sx={{ borderRadius: 1, minHeight: 48, px: 0, justifyContent: 'center', width: '100%' }}>
                <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'text.secondary' }}>
                  {coreScaffolder.icon ? (
                    <Box sx={{ display: 'flex', '& svg': { fontSize: 32 } }}>{coreScaffolder.icon}</Box>
                  ) : (
                    <HelpIcon sx={{ fontSize: 32 }} />
                  )}
                </ListItemIcon>
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {/* Runtime Extensions Fallback */}
        {runtimeExtensions.map((item, index) => {
          return (
            <ListItem key={`ext-${index}`} disablePadding>
              <Tooltip title={item.title} placement="right">
                <ListItemButton component={RouterLink} to={item.href} sx={{ borderRadius: 1, minHeight: 48, px: 0, justifyContent: 'center', width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'text.secondary' }}>
                    {item.icon ? (
                      <Box sx={{ display: 'flex', '& svg': { fontSize: 32 } }}>{item.icon}</Box>
                    ) : (
                      <HelpIcon sx={{ fontSize: 32 }} />
                    )}
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ my: 1, width: '80%' }} />

      <List sx={{ width: '100%', px: 1 }}>
        <ListItem disablePadding>
          <Tooltip title="Settings" placement="right">
            <ListItemButton component={RouterLink} to="/settings" sx={{ borderRadius: 1, minHeight: 48, px: 0, justifyContent: 'center', width: '100%' }}>
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'text.secondary' }}>
                <SettingsIcon sx={{ fontSize: 32 }} />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );
};

export const customSidebarExtension = NavContentBlueprint.make({
  name: 'custom-sidebar-menu',
  params: {
    component: CustomSidebarNav,
  },
});

export const customNavModule = createFrontendModule({
  pluginId: 'app',
  extensions: [customSidebarExtension],
});
