import styled from 'styled-components';

export const H1 = styled.h1`
  font-size: 36px;
  font-weight: 600;
  margin: 0;
`;

export const H2 = styled.h2`
  font-size: 36px;
  font-weight: 500;
  margin: 0;
  margin-bottom: 24px;
`;

export const H3 = styled.h2`
  font-size: 32px;
  font-weight: 500;
  margin: 0;
`;

export const Input = styled.input`
  background-color: #d8d8d8;
  border: none;
  border-radius: 4px;
  padding: 12px 4px;
  font-size: 14px;
  display: block;
  width: 100%;
`;
export const Label = styled.label`
  font-weight: 300;
  display: block;
  margin-bottom: 4px;
`;
export const Form = styled.form`
  margin-top: 32px;
`;

export const Button = styled.button`
  background-color: #cf3a23;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  display: block;
  width: 100%;
  border-radius: 4px;
  border: none;
  margin-top: 12px;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
`;

export const SecondaryButton = styled(Button)`
  margin: 0;
  width: auto;
  background-color: #d8d8d8;
  color: #232323;
`;

export const Card = styled.div`
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.4) 1px 1px 4px 0px;
  background-color: #fff;
`;

export const BodyCard = styled(Card)`
  padding: 32px;
  width: 40vw;
  min-width: 400px;
  max-width: 650px;
  margin-bottom: 32px;
`;
