
import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'jsx-email';

export const Template = ({
  username,
  resetLink,
}) => (
  <Html>
    <Head />
    <Preview>Reset your Crossed password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Password Reset Request</Heading>
        <Text style={text}>Hi {username},</Text>
        <Text style={text}>
          Someone requested a password reset for your Crossed account. If this wasn't you, please ignore this email.
        </Text>
        <Section style={buttonContainer}>
          <Link style={button} href={resetLink}>
            Reset Password
          </Link>
        </Section>
        <Text style={text}>
          Or copy and paste this link into your browser:{' '}
          <Link href={resetLink} style={link}>
            {resetLink}
          </Link>
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          This link will expire in 1 hour.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
  textAlign: 'center',
};

const text = {
  padding: '0 20px',
  color: '#555',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const buttonContainer = {
  textAlign: 'center',
  margin: '32px 0',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 24px',
  margin: '0 auto',
};

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
};
