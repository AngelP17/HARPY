import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace harpy. */
export namespace harpy {

    /** Namespace v1. */
    namespace v1 {

        /** Properties of an Envelope. */
        interface IEnvelope {

            /** Envelope schemaVersion */
            schemaVersion?: (string|null);

            /** Envelope serverTsMs */
            serverTsMs?: (number|Long|null);

            /** Envelope trackDeltaBatch */
            trackDeltaBatch?: (harpy.v1.ITrackDeltaBatch|null);

            /** Envelope alertUpsert */
            alertUpsert?: (harpy.v1.IAlertUpsert|null);

            /** Envelope providerStatus */
            providerStatus?: (harpy.v1.IProviderStatus|null);

            /** Envelope snapshotMeta */
            snapshotMeta?: (harpy.v1.ISnapshotMeta|null);

            /** Envelope linkUpsert */
            linkUpsert?: (harpy.v1.ILinkUpsert|null);

            /** Envelope subscriptionRequest */
            subscriptionRequest?: (harpy.v1.ISubscriptionRequest|null);

            /** Envelope subscriptionAck */
            subscriptionAck?: (harpy.v1.ISubscriptionAck|null);
        }

        /** Represents an Envelope. */
        class Envelope implements IEnvelope {

            /**
             * Constructs a new Envelope.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IEnvelope);

            /** Envelope schemaVersion. */
            public schemaVersion: string;

            /** Envelope serverTsMs. */
            public serverTsMs: (number|Long);

            /** Envelope trackDeltaBatch. */
            public trackDeltaBatch?: (harpy.v1.ITrackDeltaBatch|null);

            /** Envelope alertUpsert. */
            public alertUpsert?: (harpy.v1.IAlertUpsert|null);

            /** Envelope providerStatus. */
            public providerStatus?: (harpy.v1.IProviderStatus|null);

            /** Envelope snapshotMeta. */
            public snapshotMeta?: (harpy.v1.ISnapshotMeta|null);

            /** Envelope linkUpsert. */
            public linkUpsert?: (harpy.v1.ILinkUpsert|null);

            /** Envelope subscriptionRequest. */
            public subscriptionRequest?: (harpy.v1.ISubscriptionRequest|null);

            /** Envelope subscriptionAck. */
            public subscriptionAck?: (harpy.v1.ISubscriptionAck|null);

            /** Envelope payload. */
            public payload?: ("trackDeltaBatch"|"alertUpsert"|"providerStatus"|"snapshotMeta"|"linkUpsert"|"subscriptionRequest"|"subscriptionAck");

            /**
             * Creates a new Envelope instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Envelope instance
             */
            public static create(properties?: harpy.v1.IEnvelope): harpy.v1.Envelope;

            /**
             * Encodes the specified Envelope message. Does not implicitly {@link harpy.v1.Envelope.verify|verify} messages.
             * @param message Envelope message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Envelope message, length delimited. Does not implicitly {@link harpy.v1.Envelope.verify|verify} messages.
             * @param message Envelope message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IEnvelope, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Envelope message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Envelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.Envelope;

            /**
             * Decodes an Envelope message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Envelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.Envelope;

            /**
             * Verifies an Envelope message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Envelope message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Envelope
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.Envelope;

            /**
             * Creates a plain object from an Envelope message. Also converts values to other types if specified.
             * @param message Envelope
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.Envelope, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Envelope to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Envelope
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a TrackDeltaBatch. */
        interface ITrackDeltaBatch {

            /** TrackDeltaBatch deltas */
            deltas?: (harpy.v1.ITrackDelta[]|null);
        }

        /** Represents a TrackDeltaBatch. */
        class TrackDeltaBatch implements ITrackDeltaBatch {

            /**
             * Constructs a new TrackDeltaBatch.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ITrackDeltaBatch);

            /** TrackDeltaBatch deltas. */
            public deltas: harpy.v1.ITrackDelta[];

            /**
             * Creates a new TrackDeltaBatch instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TrackDeltaBatch instance
             */
            public static create(properties?: harpy.v1.ITrackDeltaBatch): harpy.v1.TrackDeltaBatch;

            /**
             * Encodes the specified TrackDeltaBatch message. Does not implicitly {@link harpy.v1.TrackDeltaBatch.verify|verify} messages.
             * @param message TrackDeltaBatch message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ITrackDeltaBatch, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified TrackDeltaBatch message, length delimited. Does not implicitly {@link harpy.v1.TrackDeltaBatch.verify|verify} messages.
             * @param message TrackDeltaBatch message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ITrackDeltaBatch, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TrackDeltaBatch message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns TrackDeltaBatch
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.TrackDeltaBatch;

            /**
             * Decodes a TrackDeltaBatch message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns TrackDeltaBatch
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.TrackDeltaBatch;

            /**
             * Verifies a TrackDeltaBatch message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a TrackDeltaBatch message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns TrackDeltaBatch
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.TrackDeltaBatch;

            /**
             * Creates a plain object from a TrackDeltaBatch message. Also converts values to other types if specified.
             * @param message TrackDeltaBatch
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.TrackDeltaBatch, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this TrackDeltaBatch to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for TrackDeltaBatch
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a TrackDelta. */
        interface ITrackDelta {

            /** TrackDelta id */
            id?: (string|null);

            /** TrackDelta kind */
            kind?: (harpy.v1.TrackKind|null);

            /** TrackDelta position */
            position?: (harpy.v1.IPosition|null);

            /** TrackDelta heading */
            heading?: (number|null);

            /** TrackDelta speed */
            speed?: (number|null);

            /** TrackDelta tsMs */
            tsMs?: (number|Long|null);

            /** TrackDelta providerId */
            providerId?: (string|null);

            /** TrackDelta meta */
            meta?: ({ [k: string]: string }|null);
        }

        /** Represents a TrackDelta. */
        class TrackDelta implements ITrackDelta {

            /**
             * Constructs a new TrackDelta.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ITrackDelta);

            /** TrackDelta id. */
            public id: string;

            /** TrackDelta kind. */
            public kind: harpy.v1.TrackKind;

            /** TrackDelta position. */
            public position?: (harpy.v1.IPosition|null);

            /** TrackDelta heading. */
            public heading: number;

            /** TrackDelta speed. */
            public speed: number;

            /** TrackDelta tsMs. */
            public tsMs: (number|Long);

            /** TrackDelta providerId. */
            public providerId: string;

            /** TrackDelta meta. */
            public meta: { [k: string]: string };

            /**
             * Creates a new TrackDelta instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TrackDelta instance
             */
            public static create(properties?: harpy.v1.ITrackDelta): harpy.v1.TrackDelta;

            /**
             * Encodes the specified TrackDelta message. Does not implicitly {@link harpy.v1.TrackDelta.verify|verify} messages.
             * @param message TrackDelta message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ITrackDelta, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified TrackDelta message, length delimited. Does not implicitly {@link harpy.v1.TrackDelta.verify|verify} messages.
             * @param message TrackDelta message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ITrackDelta, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TrackDelta message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns TrackDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.TrackDelta;

            /**
             * Decodes a TrackDelta message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns TrackDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.TrackDelta;

            /**
             * Verifies a TrackDelta message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a TrackDelta message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns TrackDelta
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.TrackDelta;

            /**
             * Creates a plain object from a TrackDelta message. Also converts values to other types if specified.
             * @param message TrackDelta
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.TrackDelta, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this TrackDelta to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for TrackDelta
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** TrackKind enum. */
        enum TrackKind {
            TRACK_KIND_UNSPECIFIED = 0,
            TRACK_KIND_AIRCRAFT = 1,
            TRACK_KIND_SATELLITE = 2,
            TRACK_KIND_GROUND = 3,
            TRACK_KIND_VESSEL = 4
        }

        /** Properties of a Position. */
        interface IPosition {

            /** Position lat */
            lat?: (number|null);

            /** Position lon */
            lon?: (number|null);

            /** Position alt */
            alt?: (number|null);
        }

        /** Represents a Position. */
        class Position implements IPosition {

            /**
             * Constructs a new Position.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IPosition);

            /** Position lat. */
            public lat: number;

            /** Position lon. */
            public lon: number;

            /** Position alt. */
            public alt: number;

            /**
             * Creates a new Position instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Position instance
             */
            public static create(properties?: harpy.v1.IPosition): harpy.v1.Position;

            /**
             * Encodes the specified Position message. Does not implicitly {@link harpy.v1.Position.verify|verify} messages.
             * @param message Position message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IPosition, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Position message, length delimited. Does not implicitly {@link harpy.v1.Position.verify|verify} messages.
             * @param message Position message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IPosition, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Position message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Position
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.Position;

            /**
             * Decodes a Position message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Position
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.Position;

            /**
             * Verifies a Position message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Position message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Position
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.Position;

            /**
             * Creates a plain object from a Position message. Also converts values to other types if specified.
             * @param message Position
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.Position, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Position to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Position
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of an AlertUpsert. */
        interface IAlertUpsert {

            /** AlertUpsert id */
            id?: (string|null);

            /** AlertUpsert severity */
            severity?: (harpy.v1.AlertSeverity|null);

            /** AlertUpsert title */
            title?: (string|null);

            /** AlertUpsert description */
            description?: (string|null);

            /** AlertUpsert tsMs */
            tsMs?: (number|Long|null);

            /** AlertUpsert evidenceLinkIds */
            evidenceLinkIds?: (string[]|null);

            /** AlertUpsert status */
            status?: (harpy.v1.AlertStatus|null);

            /** AlertUpsert meta */
            meta?: ({ [k: string]: string }|null);
        }

        /** Represents an AlertUpsert. */
        class AlertUpsert implements IAlertUpsert {

            /**
             * Constructs a new AlertUpsert.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IAlertUpsert);

            /** AlertUpsert id. */
            public id: string;

            /** AlertUpsert severity. */
            public severity: harpy.v1.AlertSeverity;

            /** AlertUpsert title. */
            public title: string;

            /** AlertUpsert description. */
            public description: string;

            /** AlertUpsert tsMs. */
            public tsMs: (number|Long);

            /** AlertUpsert evidenceLinkIds. */
            public evidenceLinkIds: string[];

            /** AlertUpsert status. */
            public status: harpy.v1.AlertStatus;

            /** AlertUpsert meta. */
            public meta: { [k: string]: string };

            /**
             * Creates a new AlertUpsert instance using the specified properties.
             * @param [properties] Properties to set
             * @returns AlertUpsert instance
             */
            public static create(properties?: harpy.v1.IAlertUpsert): harpy.v1.AlertUpsert;

            /**
             * Encodes the specified AlertUpsert message. Does not implicitly {@link harpy.v1.AlertUpsert.verify|verify} messages.
             * @param message AlertUpsert message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IAlertUpsert, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified AlertUpsert message, length delimited. Does not implicitly {@link harpy.v1.AlertUpsert.verify|verify} messages.
             * @param message AlertUpsert message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IAlertUpsert, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an AlertUpsert message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns AlertUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.AlertUpsert;

            /**
             * Decodes an AlertUpsert message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns AlertUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.AlertUpsert;

            /**
             * Verifies an AlertUpsert message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an AlertUpsert message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns AlertUpsert
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.AlertUpsert;

            /**
             * Creates a plain object from an AlertUpsert message. Also converts values to other types if specified.
             * @param message AlertUpsert
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.AlertUpsert, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this AlertUpsert to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for AlertUpsert
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** AlertSeverity enum. */
        enum AlertSeverity {
            ALERT_SEVERITY_UNSPECIFIED = 0,
            ALERT_SEVERITY_INFO = 1,
            ALERT_SEVERITY_WARNING = 2,
            ALERT_SEVERITY_CRITICAL = 3
        }

        /** AlertStatus enum. */
        enum AlertStatus {
            ALERT_STATUS_UNSPECIFIED = 0,
            ALERT_STATUS_ACTIVE = 1,
            ALERT_STATUS_RESOLVED = 2,
            ALERT_STATUS_ACKNOWLEDGED = 3
        }

        /** Properties of a ProviderStatus. */
        interface IProviderStatus {

            /** ProviderStatus providerId */
            providerId?: (string|null);

            /** ProviderStatus circuitState */
            circuitState?: (harpy.v1.CircuitState|null);

            /** ProviderStatus freshness */
            freshness?: (harpy.v1.Freshness|null);

            /** ProviderStatus lastSuccessTsMs */
            lastSuccessTsMs?: (number|Long|null);

            /** ProviderStatus failureCount */
            failureCount?: (number|null);

            /** ProviderStatus errorMessage */
            errorMessage?: (string|null);

            /** ProviderStatus meta */
            meta?: ({ [k: string]: string }|null);
        }

        /** Represents a ProviderStatus. */
        class ProviderStatus implements IProviderStatus {

            /**
             * Constructs a new ProviderStatus.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IProviderStatus);

            /** ProviderStatus providerId. */
            public providerId: string;

            /** ProviderStatus circuitState. */
            public circuitState: harpy.v1.CircuitState;

            /** ProviderStatus freshness. */
            public freshness: harpy.v1.Freshness;

            /** ProviderStatus lastSuccessTsMs. */
            public lastSuccessTsMs: (number|Long);

            /** ProviderStatus failureCount. */
            public failureCount: number;

            /** ProviderStatus errorMessage. */
            public errorMessage?: (string|null);

            /** ProviderStatus meta. */
            public meta: { [k: string]: string };

            /**
             * Creates a new ProviderStatus instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ProviderStatus instance
             */
            public static create(properties?: harpy.v1.IProviderStatus): harpy.v1.ProviderStatus;

            /**
             * Encodes the specified ProviderStatus message. Does not implicitly {@link harpy.v1.ProviderStatus.verify|verify} messages.
             * @param message ProviderStatus message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IProviderStatus, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ProviderStatus message, length delimited. Does not implicitly {@link harpy.v1.ProviderStatus.verify|verify} messages.
             * @param message ProviderStatus message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IProviderStatus, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ProviderStatus message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ProviderStatus
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.ProviderStatus;

            /**
             * Decodes a ProviderStatus message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ProviderStatus
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.ProviderStatus;

            /**
             * Verifies a ProviderStatus message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ProviderStatus message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ProviderStatus
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.ProviderStatus;

            /**
             * Creates a plain object from a ProviderStatus message. Also converts values to other types if specified.
             * @param message ProviderStatus
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.ProviderStatus, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ProviderStatus to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ProviderStatus
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** CircuitState enum. */
        enum CircuitState {
            CIRCUIT_STATE_UNSPECIFIED = 0,
            CIRCUIT_STATE_CLOSED = 1,
            CIRCUIT_STATE_OPEN = 2,
            CIRCUIT_STATE_HALF_OPEN = 3
        }

        /** Freshness enum. */
        enum Freshness {
            FRESHNESS_UNSPECIFIED = 0,
            FRESHNESS_FRESH = 1,
            FRESHNESS_AGING = 2,
            FRESHNESS_STALE = 3,
            FRESHNESS_CRITICAL = 4
        }

        /** Properties of a SnapshotMeta. */
        interface ISnapshotMeta {

            /** SnapshotMeta snapshotId */
            snapshotId?: (string|null);

            /** SnapshotMeta startTsMs */
            startTsMs?: (number|Long|null);

            /** SnapshotMeta endTsMs */
            endTsMs?: (number|Long|null);

            /** SnapshotMeta s3Url */
            s3Url?: (string|null);

            /** SnapshotMeta trackCount */
            trackCount?: (number|Long|null);

            /** SnapshotMeta compressedSizeBytes */
            compressedSizeBytes?: (number|Long|null);
        }

        /** Represents a SnapshotMeta. */
        class SnapshotMeta implements ISnapshotMeta {

            /**
             * Constructs a new SnapshotMeta.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ISnapshotMeta);

            /** SnapshotMeta snapshotId. */
            public snapshotId: string;

            /** SnapshotMeta startTsMs. */
            public startTsMs: (number|Long);

            /** SnapshotMeta endTsMs. */
            public endTsMs: (number|Long);

            /** SnapshotMeta s3Url. */
            public s3Url: string;

            /** SnapshotMeta trackCount. */
            public trackCount: (number|Long);

            /** SnapshotMeta compressedSizeBytes. */
            public compressedSizeBytes: (number|Long);

            /**
             * Creates a new SnapshotMeta instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SnapshotMeta instance
             */
            public static create(properties?: harpy.v1.ISnapshotMeta): harpy.v1.SnapshotMeta;

            /**
             * Encodes the specified SnapshotMeta message. Does not implicitly {@link harpy.v1.SnapshotMeta.verify|verify} messages.
             * @param message SnapshotMeta message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ISnapshotMeta, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified SnapshotMeta message, length delimited. Does not implicitly {@link harpy.v1.SnapshotMeta.verify|verify} messages.
             * @param message SnapshotMeta message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ISnapshotMeta, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SnapshotMeta message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns SnapshotMeta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.SnapshotMeta;

            /**
             * Decodes a SnapshotMeta message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns SnapshotMeta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.SnapshotMeta;

            /**
             * Verifies a SnapshotMeta message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a SnapshotMeta message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SnapshotMeta
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.SnapshotMeta;

            /**
             * Creates a plain object from a SnapshotMeta message. Also converts values to other types if specified.
             * @param message SnapshotMeta
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.SnapshotMeta, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SnapshotMeta to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SnapshotMeta
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a LinkUpsert. */
        interface ILinkUpsert {

            /** LinkUpsert id */
            id?: (string|null);

            /** LinkUpsert from */
            from?: (harpy.v1.INodeRef|null);

            /** LinkUpsert rel */
            rel?: (string|null);

            /** LinkUpsert to */
            to?: (harpy.v1.INodeRef|null);

            /** LinkUpsert tsMs */
            tsMs?: (number|Long|null);

            /** LinkUpsert meta */
            meta?: ({ [k: string]: string }|null);
        }

        /** Represents a LinkUpsert. */
        class LinkUpsert implements ILinkUpsert {

            /**
             * Constructs a new LinkUpsert.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ILinkUpsert);

            /** LinkUpsert id. */
            public id: string;

            /** LinkUpsert from. */
            public from?: (harpy.v1.INodeRef|null);

            /** LinkUpsert rel. */
            public rel: string;

            /** LinkUpsert to. */
            public to?: (harpy.v1.INodeRef|null);

            /** LinkUpsert tsMs. */
            public tsMs: (number|Long);

            /** LinkUpsert meta. */
            public meta: { [k: string]: string };

            /**
             * Creates a new LinkUpsert instance using the specified properties.
             * @param [properties] Properties to set
             * @returns LinkUpsert instance
             */
            public static create(properties?: harpy.v1.ILinkUpsert): harpy.v1.LinkUpsert;

            /**
             * Encodes the specified LinkUpsert message. Does not implicitly {@link harpy.v1.LinkUpsert.verify|verify} messages.
             * @param message LinkUpsert message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ILinkUpsert, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified LinkUpsert message, length delimited. Does not implicitly {@link harpy.v1.LinkUpsert.verify|verify} messages.
             * @param message LinkUpsert message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ILinkUpsert, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a LinkUpsert message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns LinkUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.LinkUpsert;

            /**
             * Decodes a LinkUpsert message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns LinkUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.LinkUpsert;

            /**
             * Verifies a LinkUpsert message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a LinkUpsert message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns LinkUpsert
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.LinkUpsert;

            /**
             * Creates a plain object from a LinkUpsert message. Also converts values to other types if specified.
             * @param message LinkUpsert
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.LinkUpsert, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this LinkUpsert to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for LinkUpsert
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a NodeRef. */
        interface INodeRef {

            /** NodeRef nodeType */
            nodeType?: (harpy.v1.NodeType|null);

            /** NodeRef nodeId */
            nodeId?: (string|null);
        }

        /** Represents a NodeRef. */
        class NodeRef implements INodeRef {

            /**
             * Constructs a new NodeRef.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.INodeRef);

            /** NodeRef nodeType. */
            public nodeType: harpy.v1.NodeType;

            /** NodeRef nodeId. */
            public nodeId: string;

            /**
             * Creates a new NodeRef instance using the specified properties.
             * @param [properties] Properties to set
             * @returns NodeRef instance
             */
            public static create(properties?: harpy.v1.INodeRef): harpy.v1.NodeRef;

            /**
             * Encodes the specified NodeRef message. Does not implicitly {@link harpy.v1.NodeRef.verify|verify} messages.
             * @param message NodeRef message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.INodeRef, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified NodeRef message, length delimited. Does not implicitly {@link harpy.v1.NodeRef.verify|verify} messages.
             * @param message NodeRef message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.INodeRef, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a NodeRef message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns NodeRef
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.NodeRef;

            /**
             * Decodes a NodeRef message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns NodeRef
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.NodeRef;

            /**
             * Verifies a NodeRef message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a NodeRef message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns NodeRef
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.NodeRef;

            /**
             * Creates a plain object from a NodeRef message. Also converts values to other types if specified.
             * @param message NodeRef
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.NodeRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this NodeRef to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for NodeRef
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** NodeType enum. */
        enum NodeType {
            NODE_TYPE_UNSPECIFIED = 0,
            NODE_TYPE_TRACK = 1,
            NODE_TYPE_SENSOR = 2,
            NODE_TYPE_DETECTION = 3,
            NODE_TYPE_ALERT = 4
        }

        /** Properties of a SubscriptionRequest. */
        interface ISubscriptionRequest {

            /** SubscriptionRequest viewport */
            viewport?: (harpy.v1.IBoundingBox|null);

            /** SubscriptionRequest layers */
            layers?: (harpy.v1.LayerType[]|null);

            /** SubscriptionRequest timeRange */
            timeRange?: (harpy.v1.ITimeRange|null);

            /** SubscriptionRequest mode */
            mode?: (harpy.v1.SubscriptionMode|null);
        }

        /** Represents a SubscriptionRequest. */
        class SubscriptionRequest implements ISubscriptionRequest {

            /**
             * Constructs a new SubscriptionRequest.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ISubscriptionRequest);

            /** SubscriptionRequest viewport. */
            public viewport?: (harpy.v1.IBoundingBox|null);

            /** SubscriptionRequest layers. */
            public layers: harpy.v1.LayerType[];

            /** SubscriptionRequest timeRange. */
            public timeRange?: (harpy.v1.ITimeRange|null);

            /** SubscriptionRequest mode. */
            public mode: harpy.v1.SubscriptionMode;

            /**
             * Creates a new SubscriptionRequest instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SubscriptionRequest instance
             */
            public static create(properties?: harpy.v1.ISubscriptionRequest): harpy.v1.SubscriptionRequest;

            /**
             * Encodes the specified SubscriptionRequest message. Does not implicitly {@link harpy.v1.SubscriptionRequest.verify|verify} messages.
             * @param message SubscriptionRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ISubscriptionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified SubscriptionRequest message, length delimited. Does not implicitly {@link harpy.v1.SubscriptionRequest.verify|verify} messages.
             * @param message SubscriptionRequest message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ISubscriptionRequest, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SubscriptionRequest message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns SubscriptionRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.SubscriptionRequest;

            /**
             * Decodes a SubscriptionRequest message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns SubscriptionRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.SubscriptionRequest;

            /**
             * Verifies a SubscriptionRequest message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a SubscriptionRequest message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SubscriptionRequest
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.SubscriptionRequest;

            /**
             * Creates a plain object from a SubscriptionRequest message. Also converts values to other types if specified.
             * @param message SubscriptionRequest
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.SubscriptionRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SubscriptionRequest to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SubscriptionRequest
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a BoundingBox. */
        interface IBoundingBox {

            /** BoundingBox minLat */
            minLat?: (number|null);

            /** BoundingBox minLon */
            minLon?: (number|null);

            /** BoundingBox maxLat */
            maxLat?: (number|null);

            /** BoundingBox maxLon */
            maxLon?: (number|null);
        }

        /** Represents a BoundingBox. */
        class BoundingBox implements IBoundingBox {

            /**
             * Constructs a new BoundingBox.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IBoundingBox);

            /** BoundingBox minLat. */
            public minLat: number;

            /** BoundingBox minLon. */
            public minLon: number;

            /** BoundingBox maxLat. */
            public maxLat: number;

            /** BoundingBox maxLon. */
            public maxLon: number;

            /**
             * Creates a new BoundingBox instance using the specified properties.
             * @param [properties] Properties to set
             * @returns BoundingBox instance
             */
            public static create(properties?: harpy.v1.IBoundingBox): harpy.v1.BoundingBox;

            /**
             * Encodes the specified BoundingBox message. Does not implicitly {@link harpy.v1.BoundingBox.verify|verify} messages.
             * @param message BoundingBox message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IBoundingBox, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified BoundingBox message, length delimited. Does not implicitly {@link harpy.v1.BoundingBox.verify|verify} messages.
             * @param message BoundingBox message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IBoundingBox, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a BoundingBox message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns BoundingBox
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.BoundingBox;

            /**
             * Decodes a BoundingBox message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns BoundingBox
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.BoundingBox;

            /**
             * Verifies a BoundingBox message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a BoundingBox message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns BoundingBox
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.BoundingBox;

            /**
             * Creates a plain object from a BoundingBox message. Also converts values to other types if specified.
             * @param message BoundingBox
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.BoundingBox, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this BoundingBox to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for BoundingBox
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** LayerType enum. */
        enum LayerType {
            LAYER_TYPE_UNSPECIFIED = 0,
            LAYER_TYPE_AIRCRAFT = 1,
            LAYER_TYPE_SATELLITE = 2,
            LAYER_TYPE_GROUND = 3,
            LAYER_TYPE_VESSEL = 4,
            LAYER_TYPE_CAMERA = 5,
            LAYER_TYPE_DETECTION = 6,
            LAYER_TYPE_ALERT = 7
        }

        /** Properties of a TimeRange. */
        interface ITimeRange {

            /** TimeRange live */
            live?: (harpy.v1.ILiveMode|null);

            /** TimeRange playback */
            playback?: (harpy.v1.IPlaybackMode|null);
        }

        /** Represents a TimeRange. */
        class TimeRange implements ITimeRange {

            /**
             * Constructs a new TimeRange.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ITimeRange);

            /** TimeRange live. */
            public live?: (harpy.v1.ILiveMode|null);

            /** TimeRange playback. */
            public playback?: (harpy.v1.IPlaybackMode|null);

            /** TimeRange range. */
            public range?: ("live"|"playback");

            /**
             * Creates a new TimeRange instance using the specified properties.
             * @param [properties] Properties to set
             * @returns TimeRange instance
             */
            public static create(properties?: harpy.v1.ITimeRange): harpy.v1.TimeRange;

            /**
             * Encodes the specified TimeRange message. Does not implicitly {@link harpy.v1.TimeRange.verify|verify} messages.
             * @param message TimeRange message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ITimeRange, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified TimeRange message, length delimited. Does not implicitly {@link harpy.v1.TimeRange.verify|verify} messages.
             * @param message TimeRange message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ITimeRange, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a TimeRange message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns TimeRange
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.TimeRange;

            /**
             * Decodes a TimeRange message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns TimeRange
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.TimeRange;

            /**
             * Verifies a TimeRange message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a TimeRange message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns TimeRange
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.TimeRange;

            /**
             * Creates a plain object from a TimeRange message. Also converts values to other types if specified.
             * @param message TimeRange
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.TimeRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this TimeRange to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for TimeRange
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a LiveMode. */
        interface ILiveMode {
        }

        /** Represents a LiveMode. */
        class LiveMode implements ILiveMode {

            /**
             * Constructs a new LiveMode.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ILiveMode);

            /**
             * Creates a new LiveMode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns LiveMode instance
             */
            public static create(properties?: harpy.v1.ILiveMode): harpy.v1.LiveMode;

            /**
             * Encodes the specified LiveMode message. Does not implicitly {@link harpy.v1.LiveMode.verify|verify} messages.
             * @param message LiveMode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ILiveMode, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified LiveMode message, length delimited. Does not implicitly {@link harpy.v1.LiveMode.verify|verify} messages.
             * @param message LiveMode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ILiveMode, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a LiveMode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns LiveMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.LiveMode;

            /**
             * Decodes a LiveMode message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns LiveMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.LiveMode;

            /**
             * Verifies a LiveMode message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a LiveMode message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns LiveMode
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.LiveMode;

            /**
             * Creates a plain object from a LiveMode message. Also converts values to other types if specified.
             * @param message LiveMode
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.LiveMode, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this LiveMode to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for LiveMode
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a PlaybackMode. */
        interface IPlaybackMode {

            /** PlaybackMode startTsMs */
            startTsMs?: (number|Long|null);

            /** PlaybackMode endTsMs */
            endTsMs?: (number|Long|null);
        }

        /** Represents a PlaybackMode. */
        class PlaybackMode implements IPlaybackMode {

            /**
             * Constructs a new PlaybackMode.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.IPlaybackMode);

            /** PlaybackMode startTsMs. */
            public startTsMs: (number|Long);

            /** PlaybackMode endTsMs. */
            public endTsMs: (number|Long);

            /**
             * Creates a new PlaybackMode instance using the specified properties.
             * @param [properties] Properties to set
             * @returns PlaybackMode instance
             */
            public static create(properties?: harpy.v1.IPlaybackMode): harpy.v1.PlaybackMode;

            /**
             * Encodes the specified PlaybackMode message. Does not implicitly {@link harpy.v1.PlaybackMode.verify|verify} messages.
             * @param message PlaybackMode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.IPlaybackMode, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified PlaybackMode message, length delimited. Does not implicitly {@link harpy.v1.PlaybackMode.verify|verify} messages.
             * @param message PlaybackMode message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.IPlaybackMode, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a PlaybackMode message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns PlaybackMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.PlaybackMode;

            /**
             * Decodes a PlaybackMode message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns PlaybackMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.PlaybackMode;

            /**
             * Verifies a PlaybackMode message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a PlaybackMode message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns PlaybackMode
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.PlaybackMode;

            /**
             * Creates a plain object from a PlaybackMode message. Also converts values to other types if specified.
             * @param message PlaybackMode
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.PlaybackMode, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this PlaybackMode to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for PlaybackMode
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** SubscriptionMode enum. */
        enum SubscriptionMode {
            SUBSCRIPTION_MODE_UNSPECIFIED = 0,
            SUBSCRIPTION_MODE_LIVE = 1,
            SUBSCRIPTION_MODE_PLAYBACK = 2
        }

        /** Properties of a SubscriptionAck. */
        interface ISubscriptionAck {

            /** SubscriptionAck subscriptionId */
            subscriptionId?: (string|null);

            /** SubscriptionAck success */
            success?: (boolean|null);

            /** SubscriptionAck error */
            error?: (string|null);
        }

        /** Represents a SubscriptionAck. */
        class SubscriptionAck implements ISubscriptionAck {

            /**
             * Constructs a new SubscriptionAck.
             * @param [properties] Properties to set
             */
            constructor(properties?: harpy.v1.ISubscriptionAck);

            /** SubscriptionAck subscriptionId. */
            public subscriptionId: string;

            /** SubscriptionAck success. */
            public success: boolean;

            /** SubscriptionAck error. */
            public error?: (string|null);

            /**
             * Creates a new SubscriptionAck instance using the specified properties.
             * @param [properties] Properties to set
             * @returns SubscriptionAck instance
             */
            public static create(properties?: harpy.v1.ISubscriptionAck): harpy.v1.SubscriptionAck;

            /**
             * Encodes the specified SubscriptionAck message. Does not implicitly {@link harpy.v1.SubscriptionAck.verify|verify} messages.
             * @param message SubscriptionAck message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: harpy.v1.ISubscriptionAck, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified SubscriptionAck message, length delimited. Does not implicitly {@link harpy.v1.SubscriptionAck.verify|verify} messages.
             * @param message SubscriptionAck message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: harpy.v1.ISubscriptionAck, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a SubscriptionAck message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns SubscriptionAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): harpy.v1.SubscriptionAck;

            /**
             * Decodes a SubscriptionAck message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns SubscriptionAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): harpy.v1.SubscriptionAck;

            /**
             * Verifies a SubscriptionAck message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a SubscriptionAck message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns SubscriptionAck
             */
            public static fromObject(object: { [k: string]: any }): harpy.v1.SubscriptionAck;

            /**
             * Creates a plain object from a SubscriptionAck message. Also converts values to other types if specified.
             * @param message SubscriptionAck
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: harpy.v1.SubscriptionAck, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this SubscriptionAck to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for SubscriptionAck
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
