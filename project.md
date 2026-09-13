# AI-Powered Ticket Management System

## Problem

We receive hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket — which is slow and leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, respond to, and route support tickets — delivering faster, more personalized responses to students while freeing up agents for complex issues.

## Features

- Receive support emails and create tickets
- Auto-generate human-friendly responses using a knowledge base
- Ticket list with filtering and sorting
- Ticket detail view
- AI-powered ticket classification
- AI summaries
- AI-suggested replies
- User management (admin only)
- Dashboard to view and manage all tickets

## Assumptions & Open Decisions

- **Auto-send vs. draft**: AI auto-generates and sends replies for tickets it's confident about (grounded in the knowledge base). For tickets it can't confidently handle, it produces an AI-suggested reply as a starting draft and routes the ticket to an agent.
- **Roles**: Admin (manages users/settings) and Agent (works the ticket queue, replies to students).
- **Email ingestion**: not yet decided — to be confirmed from the course material.

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js + Express
- **Database**: PostgreSQL, run locally for development; hosted elsewhere later
- **ORM**: Prisma
- **Auth**: Database-backed sessions
- **AI provider**: not yet decided
- **Email (ingestion/sending)**: not yet decided
