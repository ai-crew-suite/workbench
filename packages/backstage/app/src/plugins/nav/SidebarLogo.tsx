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
import Box from '@mui/material/Box';
import { Link } from 'react-router-dom';
import { LogoFull } from './LogoFull';
import { LogoIcon } from './LogoIcon';

interface SidebarLogoProps {
  isOpen: boolean;
}

export const SidebarLogo = ({ isOpen }: SidebarLogoProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        '& svg': {
          display: 'block',
          width: isOpen ? '130px' : '32px',
          height: 'auto',
          transition: 'width 0.1s ease-in-out',
        }
      }}
    >
      <Link
        to="/"
        aria-label="Home"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
        }}
      >
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
    </Box>
  );
};
