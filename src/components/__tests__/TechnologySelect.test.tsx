import { TechnologyLevel } from '@archivisio/c4-modelizer-sdk';
import { getTechnologiesByLevel } from '@data/technologies';
import { ColorModeProvider } from '@contexts/ColorModeContext';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TechnologySelect from '../TechnologySelect';

jest.mock('@data/technologies', () => {
  const techs = [
    {
      id: 'react',
      name: 'React',
      icon: 'react',
      color: '#61dafb',
      levels: ['component', 'code'],
    },
    {
      id: 'node',
      name: 'Node.js',
      icon: 'nodejs',
      color: '#339933',
      levels: ['component', 'code'],
    },
  ];
  return {
    getTechnologiesByLevel: jest.fn(() => techs),
    getTechnologyById: jest.fn((id: string) => techs.find((t) => t.id === id)),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        technology: 'Technology',
        select_technology: 'Select a technology',
      };
      return translations[key] || key;
    },
  }),
}));

const mockGetTechnologiesByLevel =
  getTechnologiesByLevel as jest.MockedFunction<typeof getTechnologiesByLevel>;

const mockTechnologies = [
  {
    id: 'react',
    name: 'React',
    icon: 'react',
    color: '#61dafb',
    levels: ['component', 'code'] as TechnologyLevel[],
  },
  {
    id: 'node',
    name: 'Node.js',
    icon: 'nodejs',
    color: '#339933',
    levels: ['component', 'code'] as TechnologyLevel[],
  },
];

const renderTechnologySelect = (
  props: Partial<React.ComponentProps<typeof TechnologySelect>> = {}
) => {
  const defaultProps = {
    level: 'component' as TechnologyLevel,
    value: '',
    onChange: jest.fn(),
  };

  return render(
    <ColorModeProvider>
      <TechnologySelect {...defaultProps} {...props} />
    </ColorModeProvider>
  );
};

describe('TechnologySelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTechnologiesByLevel.mockReturnValue(mockTechnologies);
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      renderTechnologySelect();
      const input = screen.getByTestId('input_technology');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      renderTechnologySelect({ label: 'Select Framework' });
      expect(screen.getByText('Select Framework')).toBeInTheDocument();
    });
  });

  describe('Technology Loading', () => {
    it('should load technologies for component level', () => {
      renderTechnologySelect({ level: 'component' });
      expect(mockGetTechnologiesByLevel).toHaveBeenCalledWith('component');
    });

    it('should load technologies for container level', () => {
      renderTechnologySelect({ level: 'container' });
      expect(mockGetTechnologiesByLevel).toHaveBeenCalledWith('container');
    });
  });

  describe('Value Selection', () => {
    it('should display selected technology', () => {
      renderTechnologySelect({ value: 'react' });
      expect(screen.getByDisplayValue('React')).toBeInTheDocument();
    });

    it('should handle unknown value gracefully', () => {
      renderTechnologySelect({ value: 'unknown-tech' });
      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('');
    });
  });
});
