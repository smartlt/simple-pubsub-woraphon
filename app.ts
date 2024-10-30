// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): IEvent | undefined;
}

interface IPublishSubscribeService {
  publish(event: IEvent, events: IEvent[]): void;
  subscribe(type: string, handler: ISubscriber): void;
  unsubscribe(eventType: string, subscriber: ISubscriber): void;
}

class PublishSubscribeService implements IPublishSubscribeService {
  private subscribers: Map<string, Set<ISubscriber>> = new Map();

  subscribe(eventType: string, subscriber: ISubscriber): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);
  }

  unsubscribe(eventType: string, subscriber: ISubscriber): void {
    this.subscribers.get(eventType)?.delete(subscriber);
  }

  publish(_event: IEvent, events: IEvent[]): void {
    const event = _event;
    const subscribers = this.subscribers.get(event.type());
    if (subscribers) {
      subscribers.forEach((subscriber) => {
        const newEvent = subscriber.handle(event);
        if (newEvent) events.push(newEvent);
        console.log(events);
      });
    }
  }
  getSubscribers(): Map<string, Set<ISubscriber>> {
    return this.subscribers;
  }
}

// implementations
class MachineSaleEvent implements IEvent {
  constructor(
    private readonly _sold: number,
    private readonly _machineId: string
  ) {}

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold;
  }

  type(): string {
    return "sale";
  }
}

class MachineRefillEvent implements IEvent {
  constructor(
    private readonly _refill: number,
    private readonly _machineId: string
  ) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return "refill";
  }

  getRefillQuantity(): number {
    return this._refill;
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  type(): string {
    return "LowStock";
  }

  machineId(): string {
    return this._machineId;
  }
}

class StockLevelOkEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  type(): string {
    return "StockLevelOk";
  }

  machineId(): string {
    return this._machineId;
  }
}

class MachineSaleSubscriber implements ISubscriber {
  constructor(private machines: Machine[]) {}

  handle(event: MachineSaleEvent): IEvent | undefined {
    if (event instanceof MachineSaleEvent) {
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        const oldLevel = machine.stockLevel;
        machine.stockLevel -= event.getSoldQuantity();
        console.log(
          event.type(),
          event.machineId(),
          event.getSoldQuantity(),
          machine.id,
          machine.stockLevel
        );
        // will only return Ok if breach the minimum stock level
        if (machine.stockLevel < 3 && oldLevel >= 3) {
          return new LowStockWarningEvent(machine.id);
        }
      }
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  constructor(private machines: Machine[]) {}

  handle(event: MachineRefillEvent): IEvent | undefined {
    if (event instanceof MachineRefillEvent) {
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        const oldLevel = machine.stockLevel;
        machine.stockLevel += event.getRefillQuantity();
        console.log(
          event.type(),
          event.machineId(),
          event.getRefillQuantity(),
          machine.id,
          machine.stockLevel
        );
        // Will only return Ok if breach the minimum stock level
        if (machine.stockLevel >= 3 && oldLevel < 3) {
          return new StockLevelOkEvent(machine.id);
        }
      }
    }
  }
}

class StockwarningSubscriber implements ISubscriber {
  constructor(private machines: Machine[]) {}
  handle(event: LowStockWarningEvent): IEvent | undefined {
    if (event instanceof LowStockWarningEvent) {
      console.log(event.type(), event.machineId());
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        return new MachineRefillEvent(3 - machine.stockLevel, machine.id);
      }
    }
  }
}

class StockLevelOkSubscriber implements ISubscriber {
  constructor(private machines: Machine[]) {}
  handle(event: StockLevelOkEvent): undefined {
    if (event instanceof StockLevelOkEvent) {
      console.log(event.type(), event.machineId());
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        //TODO
      }
    }
  }
}

// objects
class Machine {
  // stock level is 3 to check stock level warning and ok events
  public stockLevel = 3;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }
}

// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return "001";
  } else if (random < 2) {
    return "002";
  }
  return "003";
};

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  }
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
};

// program
(async () => {
  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];
  // create the PubSub service
  const pubSubService: PublishSubscribeService = new PublishSubscribeService();

  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refilSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new StockwarningSubscriber(machines);
  const stockLevelOkSubscriber = new StockLevelOkSubscriber(machines);

  pubSubService.subscribe("sale", saleSubscriber);
  pubSubService.subscribe("refill", refilSubscriber);
  pubSubService.subscribe("LowStock", stockWarningSubscriber);
  pubSubService.subscribe("StockLevelOk", stockLevelOkSubscriber);

  // create 5 random events
  const events = [1, 2, 3, 4, 5].map((i) => eventGenerator());

  // publish the events
  while (events.length > 0) {
    pubSubService.publish(events.shift(), events);
  }

  machines.map((machine) => {
    console.log(machine.id, machine.stockLevel);
  });
})();
