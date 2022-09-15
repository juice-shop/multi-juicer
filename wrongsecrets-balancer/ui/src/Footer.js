import React from 'react';
import Popup from 'reactjs-popup';
import styled from 'styled-components';
import { FormattedMessage } from 'react-intl';

import translations from './translations';

const LanguageSwitchButton = styled.button`
  border: none;
  background-color: var(--background-highlight);
  color: var(--font-color)
  font-size: 12px;
  cursor: pointer;
  align-items: baseline;
  padding: 4px 8px;
  border-radius: 2px;
`;

const LanguageSelectionButton = styled(LanguageSwitchButton)`
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: ${(props) => (props.showAsActive ? '600' : 'initial')};
`;

const LangPopupWrapper = styled.div`
  padding: 8px;
  display: flex;
  align-content: center;
  flex-direction: column;
  max-height: 400px;
  overflow-y: scroll;
`;

export const Footer = ({ switchLanguage, selectedLocale }) => {
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  return (
    <Popup
      contentStyle={{
        border: 'none',
        borderRadius: '6px',
        boxShadow: 'rgba(0, 0, 0, 0.4) 1px 1px 4px 0px',
        backgroundColor: prefersDarkScheme ? '#2d3848' : '#fff',
        padding: '0',
      }}
      arrowStyle={{
        color: prefersDarkScheme ? '#2d3848' : '#fff',
      }}
      trigger={
        <LanguageSwitchButton>
          <span role="img" aria-label="globe">
            🌍
          </span>{' '}
          <span>
            <FormattedMessage id="change_language" defaultMessage="Change Language" />
          </span>
        </LanguageSwitchButton>
      }
      position="top center"
    >
      <LangPopupWrapper>
        {translations.map((translation) => {
          return (
            <LanguageSelectionButton
              key={`translation-${translation.key}`}
              showAsActive={selectedLocale === translation.key}
              onClick={() =>
                switchLanguage({
                  key: translation.key,
                  messageLoader: translation.messageLoader(),
                })
              }
            >
              <span role="img" aria-label={`${translation.name} Flag`}>
                {translation.flag}
              </span>{' '}
              <span>{translation.name}</span>
            </LanguageSelectionButton>
          );
        })}
      </LangPopupWrapper>
    </Popup>
  );
};
