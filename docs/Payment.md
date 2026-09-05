# OpenLabs Project API Documentation

This project supports multiple API endpoints for handling USSD sessions, user interactions, educational data, and integration with Muviin payment.

## POST /api/v1/ussd/start
**Description**: Start a USSD session

#### Example JSON Body:
- `sessionID`: `abc123`
- `userID`: `1`
- `newSession`: `True`
- `msisdn`: `233548209019`
- `userData`: ``
- `network`: `MTN`

## POST /api/v1/ussd/next
**Description**: Continue USSD session

#### Example JSON Body:
- `sessionID`: `abc123`
- `userID`: `1`
- `newSession`: `False`
- `msisdn`: `233548209019`
- `userData`: `1`
- `network`: `MTN`

## GET /api/v1/download/:modelName
**Description**: Download Excel of model data

**Example URL**: `/api/v1/download/Program`

## GET /api/v1/ussd/sessions
**Description**: Get all USSD sessions

## GET /api/v1/ussd/sessions/:userID
**Description**: Get USSD sessions for a specific user

**Example URL**: `/api/v1/ussd/sessions/1`

## POST /api/v1/payment/initiate
**Description**: Initiate a Muviin payment

#### Example JSON Body:
- `amount`: `5`
- `fromAccount`: `0548209019`
- `toAccount`: `0555555555`
- `bundle`: `1GB Daily`
- `network`: `MTN`
- `fromNetwork`: `MTN`

