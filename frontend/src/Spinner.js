import React from 'react';
import styled from 'styled-components';

const StyledSpinner = styled.svg`
  animation: rotate 1s linear infinite;
  width: 30px;
  height: 30px;
  margin-right: 16px;

  & .path {
    stroke: #5652bf;
    stroke-linecap: round;
    animation: dash 1.5s ease-in-out infinite;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }
`;

export const Spinner = () => (
  <StyledSpinner viewBox="0 0 30 30">
    <circle
      className="path"
      cx="15"
      cy="15"
      r="13"
      fill="none"
      strokeWidth="2"
    />
  </StyledSpinner>
);
