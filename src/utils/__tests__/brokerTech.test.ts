import { inferChannelRole, isBrokerTechnology, isBrokerView, protocolFromBrokerTech } from '../brokerTech';

describe('brokerTech', () => {
  it('treats catalog ids and apachekafka alias as brokers', () => {
    expect(isBrokerTechnology('kafka')).toBe(true);
    expect(isBrokerTechnology('apachekafka')).toBe(true);
    expect(isBrokerTechnology('rabbitmq')).toBe(true);
    expect(isBrokerTechnology('postgresql')).toBe(false);
  });

  it('maps parent tech to a channel protocol', () => {
    expect(protocolFromBrokerTech('kafka')).toBe('kafka');
    expect(protocolFromBrokerTech('apachekafka')).toBe('kafka');
    expect(protocolFromBrokerTech('rabbitmq')).toBe('amqp');
    expect(protocolFromBrokerTech('amazonsqs')).toBe('sqs');
    expect(protocolFromBrokerTech('redisstreams')).toBe('redis-stream');
  });

  it('opens broker view only on the component layer of a broker', () => {
    const model = {
      viewLevel: 'component' as const,
      activeContainerId: 'bus',
      containers: [{ id: 'bus', technology: 'apachekafka' }],
    };
    expect(isBrokerView(model)).toBe(true);
    expect(isBrokerView({ ...model, viewLevel: 'container' })).toBe(false);
    expect(
      isBrokerView({
        ...model,
        containers: [{ id: 'bus', technology: 'spring' }],
      })
    ).toBe(false);
  });

  it('defaults produce toward the broker and consume away from it', () => {
    expect(inferChannelRole({ sourceIsBroker: false, targetIsBroker: true })).toBe('produce');
    expect(inferChannelRole({ sourceIsBroker: true, targetIsBroker: false })).toBe('consume');
  });
});
