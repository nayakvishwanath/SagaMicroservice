# SAGA Microservice Pattern

## Overview

This repository demonstrates the **SAGA design pattern** for managing distributed transactions across microservices in a Node.js environment. The SAGA pattern provides an alternative to traditional ACID transactions by coordinating a series of local transactions across multiple microservices.

## What is the SAGA Pattern?

The SAGA pattern is a way to manage distributed transactions without relying on traditional two-phase commit protocols. Instead, a saga is a sequence of local transactions, where each transaction updates the database and triggers the next transaction in the saga.

### Key Characteristics:
- **Distributed Transactions**: Manages transactions across multiple services
- **No Distributed Locks**: Avoids long-held locks on resources
- **Eventual Consistency**: Ensures data consistency through compensating transactions
- **Failure Handling**: Implements automatic rollback through compensating transactions

## SAGA Patterns Implemented

### 1. Orchestration Pattern

The Orchestration pattern uses a central orchestrator service that coordinates all the steps in a saga.

**Characteristics:**
- Centralized control and sequencing
- Single point of coordination
- Easier to understand and debug
- Potential single point of failure
- Tightly coupled services

**Use Cases:**
- Complex workflows with many steps
- When you need centralized transaction management
- Systems requiring detailed monitoring and logging

**Run Demo:**
```bash
npm run orchestration
```

### 2. Choreography Pattern

The Choreography pattern distributes the coordination logic across services. Each service listens for events and triggers actions accordingly.

**Characteristics:**
- Decentralized control
- Services are loosely coupled
- Event-driven architecture
- Can be harder to debug and trace
- Scales well with many services

**Use Cases:**
- Loosely coupled microservices
- Event-driven architectures
- Systems with many independent services
- Real-time processing requirements

**Run Demo:**
```bash
npm run choreography
```

## Project Structure

```
SagaMicroservice/
├── src/
│   ├── index.js
│   ├── orchestration/
│   │   ├── demo.js
│   │   ├── orchestrator.js
│   │   └── services/
│   └── choreography/
│       ├── demo.js
│       ├── eventBus.js
│       └── services/
├── package.json
└── README.md
```

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/nayakvishwanath/SagaMicroservice.git
cd SagaMicroservice
npm install
```

## Quick Start

### Run Orchestration Example
```bash
npm run orchestration
```

### Run Choreography Example
```bash
npm run choreography
```

### Run All Examples
```bash
npm start
```

## SAGA Pattern Comparison

| Feature | Orchestration | Choreography |
|---------|---------------|--------------|
| **Control Flow** | Centralized | Distributed |
| **Coupling** | Tightly Coupled | Loosely Coupled |
| **Complexity** | Medium | High |
| **Debugging** | Easier | Harder |
| **Performance** | Faster | Potentially Slower |
| **Scalability** | Limited | Better |
| **Failure Handling** | Centralized | Distributed |

## Compensating Transactions

A key aspect of the SAGA pattern is the use of compensating transactions to handle failures:

- When a step fails, all previous steps are rolled back using compensating transactions
- Compensating transactions undo the work of the forward transactions
- They must be idempotent (safe to call multiple times)

## Real-World Example: Order Processing

### Orchestration Flow:
1. **Order Service** receives order
2. **Orchestrator** calls:
   - Payment Service → Process Payment
   - Inventory Service → Reserve Items
   - Shipping Service → Schedule Delivery
3. If any step fails, **compensating transactions** are triggered

### Choreography Flow:
1. **Order Service** creates order (emits event)
2. **Payment Service** processes payment (emits event)
3. **Inventory Service** reserves items (emits event)
4. **Shipping Service** schedules delivery (emits event)
5. On failure, services emit compensation events

## When to Use SAGA Pattern

### ✅ Use SAGA When:
- Managing workflows across multiple microservices
- You need eventual consistency (not immediate consistency)
- You want to avoid distributed locks
- Services need to remain loosely coupled
- You need automatic failure recovery

### ❌ Don't Use SAGA When:
- You need strict ACID transactions
- Services are tightly coupled
- Immediate consistency is critical
- System is simple with few services
- Traditional database transactions suffice

## Best Practices

1. **Idempotent Operations**: All operations should be safe to execute multiple times
2. **Compensating Transactions**: Always implement them for each forward transaction
3. **Event Ordering**: Ensure events are processed in the correct order
4. **Timeout Handling**: Implement proper timeout mechanisms
5. **Monitoring & Logging**: Log all saga steps for debugging
6. **Error Handling**: Implement comprehensive error handling and retry logic
7. **Testing**: Test both happy path and failure scenarios

## Common Challenges

1. **Debugging**: Distributed tracing becomes complex
2. **Compensation Logic**: Must ensure all compensating transactions are correct
3. **Eventual Consistency**: Applications must handle temporary inconsistency
4. **Idempotency**: Services must handle duplicate requests
5. **Monitoring**: Requires sophisticated monitoring and alerting

## Resources

- [Microservices Patterns - SAGA](https://microservices.io/patterns/data/saga.html)
- [AWS SAGA Pattern Documentation](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/saga-orchestration-pattern.html)
- [Microsoft Azure SAGA Pattern](https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/saga/saga)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Created as an educational example for understanding SAGA design patterns in microservices architecture.

---

**Last Updated**: 2026-04-18 15:51:30