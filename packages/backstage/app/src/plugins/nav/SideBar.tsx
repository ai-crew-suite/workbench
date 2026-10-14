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
import { useState } from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { NavContentBlueprint, type NavContentComponent } from '@backstage/plugin-app-react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { Search as SearchIcon, Help as HelpIcon, Settings as SettingsIcon, ChevronLeft, Menu as MenuIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { SidebarLogo } from './SideBarLogo';

/**
 * Collapsible custom sidebar rendered as the app's nav content. It takes and
 * hides framework-managed entries (search, notifications, visualizer), pins
 * the catalog and scaffolder items to the top, and renders the rest below.
 */
const CustomSidebarNav: NavContentComponent = ({ navItems }) => {
  navItems.take('page:search');
  navItems.take('page:notifications');
  navItems.take('plugin:notifications');
  navItems.take('page:app-visualizer');
  // Hidden in favor of the dedicated settings entry rendered at the bottom.
  navItems.take('page:user-settings');

  const coreCatalog = navItems.take('page:catalog');
  const coreScaffolder = navItems.take('page:scaffolder');
  const runtimeExtensions = navItems.rest();

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Box
      sx={{
        width: isOpen ? 240 : 72,
        transition: 'width 0.2s ease-in-out',
        height: '100vh',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        py: 2,
        boxSizing: 'border-box',
      }}
    >
      {/* Header Action Row controls slider drawer state updates */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: isOpen ? 'space-between' : 'center', px: isOpen ? 2 : 0, width: '100%', height: 56, minHeight: 56 }}>
        <Box sx={{ display: 'flex', width: isOpen ? 'auto' : 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <SidebarLogo isOpen={isOpen} />
        </Box>
        <IconButton onClick={() => setIsOpen(!isOpen)} size="medium" sx={{ color: 'primary.main', ml: isOpen ? 1 : 0 }}>
          {isOpen ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>
      </Box>

      {/* Core Menu Lists */}
      <List sx={{ width: '100%', mt: 2, px: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ListItem disablePadding>
          <Tooltip title={isOpen ? "" : "Search"} placement="right">
            <ListItemButton component={Link} to="/search" sx={{ borderRadius: 1, minHeight: 48, px: isOpen ? 2 : 0, justifyContent: isOpen ? 'flex-start' : 'center', width: '100%' }}>
              <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, justifyContent: 'center' }}>
                <SearchIcon color="primary" />
              </ListItemIcon>
              {isOpen && <ListItemText primary="Search" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>

        <Divider sx={{ my: 1 }} />

        {[coreCatalog, coreScaffolder].map((item, index) => {
          if (!item) return null;
          return (
            <ListItem key={index} disablePadding>
              <Tooltip title={item.title} placement="right">
                <ListItemButton component={Link} to={item.href} sx={{ borderRadius: 1, minHeight: 48, px: isOpen ? 2 : 0, justifyContent: isOpen ? 'flex-start' : 'center', width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, justifyContent: 'center', color: 'text.secondary' }}>
                    {item.icon ? <>{item.icon}</> : <HelpIcon />}
                  </ListItemIcon>
                  {isOpen && <ListItemText primary={item.title} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}

        {runtimeExtensions.map((item, index) => {
          return (
            <ListItem key={index} disablePadding>
              <Tooltip title={item.title} placement="right">
                <ListItemButton component={Link} to={item.href} sx={{ borderRadius: 1, minHeight: 48, px: isOpen ? 2 : 0, justifyContent: isOpen ? 'flex-start' : 'center', width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, justifyContent: 'center', color: 'text.secondary' }}>
                    {item.icon ? <>{item.icon}</> : <HelpIcon />}
                  </ListItemIcon>
                  {isOpen && <ListItemText primary={item.title} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ my: 1, mx: 1 }} />

      <List sx={{ width: '100%', px: 1 }}>
        <ListItem disablePadding>
          <Tooltip title={isOpen ? "" : "Settings"} placement="right">
            <ListItemButton component={Link} to="/settings" sx={{ borderRadius: 1, minHeight: 48, px: isOpen ? 2 : 0, justifyContent: isOpen ? 'flex-start' : 'center', width: '100%' }}>
              <ListItemIcon sx={{ minWidth: 0, mr: isOpen ? 2 : 0, justifyContent: 'center', color: 'text.secondary' }}>
                <SettingsIcon />
              </ListItemIcon>
              {isOpen && <ListItemText primary="Settings" />}
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
