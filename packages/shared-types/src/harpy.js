/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const harpy = $root.harpy = (() => {

    /**
     * Namespace harpy.
     * @exports harpy
     * @namespace
     */
    const harpy = {};

    harpy.v1 = (function() {

        /**
         * Namespace v1.
         * @memberof harpy
         * @namespace
         */
        const v1 = {};

        v1.Envelope = (function() {

            /**
             * Properties of an Envelope.
             * @memberof harpy.v1
             * @interface IEnvelope
             * @property {string|null} [schemaVersion] Envelope schemaVersion
             * @property {number|Long|null} [serverTsMs] Envelope serverTsMs
             * @property {harpy.v1.ITrackDeltaBatch|null} [trackDeltaBatch] Envelope trackDeltaBatch
             * @property {harpy.v1.IAlertUpsert|null} [alertUpsert] Envelope alertUpsert
             * @property {harpy.v1.IProviderStatus|null} [providerStatus] Envelope providerStatus
             * @property {harpy.v1.ISnapshotMeta|null} [snapshotMeta] Envelope snapshotMeta
             * @property {harpy.v1.ILinkUpsert|null} [linkUpsert] Envelope linkUpsert
             * @property {harpy.v1.ISubscriptionRequest|null} [subscriptionRequest] Envelope subscriptionRequest
             * @property {harpy.v1.ISubscriptionAck|null} [subscriptionAck] Envelope subscriptionAck
             */

            /**
             * Constructs a new Envelope.
             * @memberof harpy.v1
             * @classdesc Represents an Envelope.
             * @implements IEnvelope
             * @constructor
             * @param {harpy.v1.IEnvelope=} [properties] Properties to set
             */
            function Envelope(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Envelope schemaVersion.
             * @member {string} schemaVersion
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.schemaVersion = "";

            /**
             * Envelope serverTsMs.
             * @member {number|Long} serverTsMs
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.serverTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * Envelope trackDeltaBatch.
             * @member {harpy.v1.ITrackDeltaBatch|null|undefined} trackDeltaBatch
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.trackDeltaBatch = null;

            /**
             * Envelope alertUpsert.
             * @member {harpy.v1.IAlertUpsert|null|undefined} alertUpsert
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.alertUpsert = null;

            /**
             * Envelope providerStatus.
             * @member {harpy.v1.IProviderStatus|null|undefined} providerStatus
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.providerStatus = null;

            /**
             * Envelope snapshotMeta.
             * @member {harpy.v1.ISnapshotMeta|null|undefined} snapshotMeta
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.snapshotMeta = null;

            /**
             * Envelope linkUpsert.
             * @member {harpy.v1.ILinkUpsert|null|undefined} linkUpsert
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.linkUpsert = null;

            /**
             * Envelope subscriptionRequest.
             * @member {harpy.v1.ISubscriptionRequest|null|undefined} subscriptionRequest
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.subscriptionRequest = null;

            /**
             * Envelope subscriptionAck.
             * @member {harpy.v1.ISubscriptionAck|null|undefined} subscriptionAck
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Envelope.prototype.subscriptionAck = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * Envelope payload.
             * @member {"trackDeltaBatch"|"alertUpsert"|"providerStatus"|"snapshotMeta"|"linkUpsert"|"subscriptionRequest"|"subscriptionAck"|undefined} payload
             * @memberof harpy.v1.Envelope
             * @instance
             */
            Object.defineProperty(Envelope.prototype, "payload", {
                get: $util.oneOfGetter($oneOfFields = ["trackDeltaBatch", "alertUpsert", "providerStatus", "snapshotMeta", "linkUpsert", "subscriptionRequest", "subscriptionAck"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new Envelope instance using the specified properties.
             * @function create
             * @memberof harpy.v1.Envelope
             * @static
             * @param {harpy.v1.IEnvelope=} [properties] Properties to set
             * @returns {harpy.v1.Envelope} Envelope instance
             */
            Envelope.create = function create(properties) {
                return new Envelope(properties);
            };

            /**
             * Encodes the specified Envelope message. Does not implicitly {@link harpy.v1.Envelope.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.Envelope
             * @static
             * @param {harpy.v1.IEnvelope} message Envelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Envelope.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.schemaVersion != null && Object.hasOwnProperty.call(message, "schemaVersion"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.schemaVersion);
                if (message.serverTsMs != null && Object.hasOwnProperty.call(message, "serverTsMs"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.serverTsMs);
                if (message.trackDeltaBatch != null && Object.hasOwnProperty.call(message, "trackDeltaBatch"))
                    $root.harpy.v1.TrackDeltaBatch.encode(message.trackDeltaBatch, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
                if (message.alertUpsert != null && Object.hasOwnProperty.call(message, "alertUpsert"))
                    $root.harpy.v1.AlertUpsert.encode(message.alertUpsert, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
                if (message.providerStatus != null && Object.hasOwnProperty.call(message, "providerStatus"))
                    $root.harpy.v1.ProviderStatus.encode(message.providerStatus, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
                if (message.snapshotMeta != null && Object.hasOwnProperty.call(message, "snapshotMeta"))
                    $root.harpy.v1.SnapshotMeta.encode(message.snapshotMeta, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
                if (message.linkUpsert != null && Object.hasOwnProperty.call(message, "linkUpsert"))
                    $root.harpy.v1.LinkUpsert.encode(message.linkUpsert, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
                if (message.subscriptionRequest != null && Object.hasOwnProperty.call(message, "subscriptionRequest"))
                    $root.harpy.v1.SubscriptionRequest.encode(message.subscriptionRequest, writer.uint32(/* id 20, wireType 2 =*/162).fork()).ldelim();
                if (message.subscriptionAck != null && Object.hasOwnProperty.call(message, "subscriptionAck"))
                    $root.harpy.v1.SubscriptionAck.encode(message.subscriptionAck, writer.uint32(/* id 21, wireType 2 =*/170).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified Envelope message, length delimited. Does not implicitly {@link harpy.v1.Envelope.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.Envelope
             * @static
             * @param {harpy.v1.IEnvelope} message Envelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Envelope.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Envelope message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.Envelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.Envelope} Envelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Envelope.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.Envelope();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.schemaVersion = reader.string();
                            break;
                        }
                    case 2: {
                            message.serverTsMs = reader.uint64();
                            break;
                        }
                    case 10: {
                            message.trackDeltaBatch = $root.harpy.v1.TrackDeltaBatch.decode(reader, reader.uint32());
                            break;
                        }
                    case 11: {
                            message.alertUpsert = $root.harpy.v1.AlertUpsert.decode(reader, reader.uint32());
                            break;
                        }
                    case 12: {
                            message.providerStatus = $root.harpy.v1.ProviderStatus.decode(reader, reader.uint32());
                            break;
                        }
                    case 13: {
                            message.snapshotMeta = $root.harpy.v1.SnapshotMeta.decode(reader, reader.uint32());
                            break;
                        }
                    case 14: {
                            message.linkUpsert = $root.harpy.v1.LinkUpsert.decode(reader, reader.uint32());
                            break;
                        }
                    case 20: {
                            message.subscriptionRequest = $root.harpy.v1.SubscriptionRequest.decode(reader, reader.uint32());
                            break;
                        }
                    case 21: {
                            message.subscriptionAck = $root.harpy.v1.SubscriptionAck.decode(reader, reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Envelope message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.Envelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.Envelope} Envelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Envelope.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Envelope message.
             * @function verify
             * @memberof harpy.v1.Envelope
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Envelope.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.schemaVersion != null && message.hasOwnProperty("schemaVersion"))
                    if (!$util.isString(message.schemaVersion))
                        return "schemaVersion: string expected";
                if (message.serverTsMs != null && message.hasOwnProperty("serverTsMs"))
                    if (!$util.isInteger(message.serverTsMs) && !(message.serverTsMs && $util.isInteger(message.serverTsMs.low) && $util.isInteger(message.serverTsMs.high)))
                        return "serverTsMs: integer|Long expected";
                if (message.trackDeltaBatch != null && message.hasOwnProperty("trackDeltaBatch")) {
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.TrackDeltaBatch.verify(message.trackDeltaBatch);
                        if (error)
                            return "trackDeltaBatch." + error;
                    }
                }
                if (message.alertUpsert != null && message.hasOwnProperty("alertUpsert")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.AlertUpsert.verify(message.alertUpsert);
                        if (error)
                            return "alertUpsert." + error;
                    }
                }
                if (message.providerStatus != null && message.hasOwnProperty("providerStatus")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.ProviderStatus.verify(message.providerStatus);
                        if (error)
                            return "providerStatus." + error;
                    }
                }
                if (message.snapshotMeta != null && message.hasOwnProperty("snapshotMeta")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.SnapshotMeta.verify(message.snapshotMeta);
                        if (error)
                            return "snapshotMeta." + error;
                    }
                }
                if (message.linkUpsert != null && message.hasOwnProperty("linkUpsert")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.LinkUpsert.verify(message.linkUpsert);
                        if (error)
                            return "linkUpsert." + error;
                    }
                }
                if (message.subscriptionRequest != null && message.hasOwnProperty("subscriptionRequest")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.SubscriptionRequest.verify(message.subscriptionRequest);
                        if (error)
                            return "subscriptionRequest." + error;
                    }
                }
                if (message.subscriptionAck != null && message.hasOwnProperty("subscriptionAck")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.harpy.v1.SubscriptionAck.verify(message.subscriptionAck);
                        if (error)
                            return "subscriptionAck." + error;
                    }
                }
                return null;
            };

            /**
             * Creates an Envelope message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.Envelope
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.Envelope} Envelope
             */
            Envelope.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.Envelope)
                    return object;
                let message = new $root.harpy.v1.Envelope();
                if (object.schemaVersion != null)
                    message.schemaVersion = String(object.schemaVersion);
                if (object.serverTsMs != null)
                    if ($util.Long)
                        (message.serverTsMs = $util.Long.fromValue(object.serverTsMs)).unsigned = true;
                    else if (typeof object.serverTsMs === "string")
                        message.serverTsMs = parseInt(object.serverTsMs, 10);
                    else if (typeof object.serverTsMs === "number")
                        message.serverTsMs = object.serverTsMs;
                    else if (typeof object.serverTsMs === "object")
                        message.serverTsMs = new $util.LongBits(object.serverTsMs.low >>> 0, object.serverTsMs.high >>> 0).toNumber(true);
                if (object.trackDeltaBatch != null) {
                    if (typeof object.trackDeltaBatch !== "object")
                        throw TypeError(".harpy.v1.Envelope.trackDeltaBatch: object expected");
                    message.trackDeltaBatch = $root.harpy.v1.TrackDeltaBatch.fromObject(object.trackDeltaBatch);
                }
                if (object.alertUpsert != null) {
                    if (typeof object.alertUpsert !== "object")
                        throw TypeError(".harpy.v1.Envelope.alertUpsert: object expected");
                    message.alertUpsert = $root.harpy.v1.AlertUpsert.fromObject(object.alertUpsert);
                }
                if (object.providerStatus != null) {
                    if (typeof object.providerStatus !== "object")
                        throw TypeError(".harpy.v1.Envelope.providerStatus: object expected");
                    message.providerStatus = $root.harpy.v1.ProviderStatus.fromObject(object.providerStatus);
                }
                if (object.snapshotMeta != null) {
                    if (typeof object.snapshotMeta !== "object")
                        throw TypeError(".harpy.v1.Envelope.snapshotMeta: object expected");
                    message.snapshotMeta = $root.harpy.v1.SnapshotMeta.fromObject(object.snapshotMeta);
                }
                if (object.linkUpsert != null) {
                    if (typeof object.linkUpsert !== "object")
                        throw TypeError(".harpy.v1.Envelope.linkUpsert: object expected");
                    message.linkUpsert = $root.harpy.v1.LinkUpsert.fromObject(object.linkUpsert);
                }
                if (object.subscriptionRequest != null) {
                    if (typeof object.subscriptionRequest !== "object")
                        throw TypeError(".harpy.v1.Envelope.subscriptionRequest: object expected");
                    message.subscriptionRequest = $root.harpy.v1.SubscriptionRequest.fromObject(object.subscriptionRequest);
                }
                if (object.subscriptionAck != null) {
                    if (typeof object.subscriptionAck !== "object")
                        throw TypeError(".harpy.v1.Envelope.subscriptionAck: object expected");
                    message.subscriptionAck = $root.harpy.v1.SubscriptionAck.fromObject(object.subscriptionAck);
                }
                return message;
            };

            /**
             * Creates a plain object from an Envelope message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.Envelope
             * @static
             * @param {harpy.v1.Envelope} message Envelope
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Envelope.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.schemaVersion = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.serverTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.serverTsMs = options.longs === String ? "0" : 0;
                }
                if (message.schemaVersion != null && message.hasOwnProperty("schemaVersion"))
                    object.schemaVersion = message.schemaVersion;
                if (message.serverTsMs != null && message.hasOwnProperty("serverTsMs"))
                    if (typeof message.serverTsMs === "number")
                        object.serverTsMs = options.longs === String ? String(message.serverTsMs) : message.serverTsMs;
                    else
                        object.serverTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.serverTsMs) : options.longs === Number ? new $util.LongBits(message.serverTsMs.low >>> 0, message.serverTsMs.high >>> 0).toNumber(true) : message.serverTsMs;
                if (message.trackDeltaBatch != null && message.hasOwnProperty("trackDeltaBatch")) {
                    object.trackDeltaBatch = $root.harpy.v1.TrackDeltaBatch.toObject(message.trackDeltaBatch, options);
                    if (options.oneofs)
                        object.payload = "trackDeltaBatch";
                }
                if (message.alertUpsert != null && message.hasOwnProperty("alertUpsert")) {
                    object.alertUpsert = $root.harpy.v1.AlertUpsert.toObject(message.alertUpsert, options);
                    if (options.oneofs)
                        object.payload = "alertUpsert";
                }
                if (message.providerStatus != null && message.hasOwnProperty("providerStatus")) {
                    object.providerStatus = $root.harpy.v1.ProviderStatus.toObject(message.providerStatus, options);
                    if (options.oneofs)
                        object.payload = "providerStatus";
                }
                if (message.snapshotMeta != null && message.hasOwnProperty("snapshotMeta")) {
                    object.snapshotMeta = $root.harpy.v1.SnapshotMeta.toObject(message.snapshotMeta, options);
                    if (options.oneofs)
                        object.payload = "snapshotMeta";
                }
                if (message.linkUpsert != null && message.hasOwnProperty("linkUpsert")) {
                    object.linkUpsert = $root.harpy.v1.LinkUpsert.toObject(message.linkUpsert, options);
                    if (options.oneofs)
                        object.payload = "linkUpsert";
                }
                if (message.subscriptionRequest != null && message.hasOwnProperty("subscriptionRequest")) {
                    object.subscriptionRequest = $root.harpy.v1.SubscriptionRequest.toObject(message.subscriptionRequest, options);
                    if (options.oneofs)
                        object.payload = "subscriptionRequest";
                }
                if (message.subscriptionAck != null && message.hasOwnProperty("subscriptionAck")) {
                    object.subscriptionAck = $root.harpy.v1.SubscriptionAck.toObject(message.subscriptionAck, options);
                    if (options.oneofs)
                        object.payload = "subscriptionAck";
                }
                return object;
            };

            /**
             * Converts this Envelope to JSON.
             * @function toJSON
             * @memberof harpy.v1.Envelope
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Envelope.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Envelope
             * @function getTypeUrl
             * @memberof harpy.v1.Envelope
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Envelope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.Envelope";
            };

            return Envelope;
        })();

        v1.TrackDeltaBatch = (function() {

            /**
             * Properties of a TrackDeltaBatch.
             * @memberof harpy.v1
             * @interface ITrackDeltaBatch
             * @property {Array.<harpy.v1.ITrackDelta>|null} [deltas] TrackDeltaBatch deltas
             */

            /**
             * Constructs a new TrackDeltaBatch.
             * @memberof harpy.v1
             * @classdesc Represents a TrackDeltaBatch.
             * @implements ITrackDeltaBatch
             * @constructor
             * @param {harpy.v1.ITrackDeltaBatch=} [properties] Properties to set
             */
            function TrackDeltaBatch(properties) {
                this.deltas = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * TrackDeltaBatch deltas.
             * @member {Array.<harpy.v1.ITrackDelta>} deltas
             * @memberof harpy.v1.TrackDeltaBatch
             * @instance
             */
            TrackDeltaBatch.prototype.deltas = $util.emptyArray;

            /**
             * Creates a new TrackDeltaBatch instance using the specified properties.
             * @function create
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {harpy.v1.ITrackDeltaBatch=} [properties] Properties to set
             * @returns {harpy.v1.TrackDeltaBatch} TrackDeltaBatch instance
             */
            TrackDeltaBatch.create = function create(properties) {
                return new TrackDeltaBatch(properties);
            };

            /**
             * Encodes the specified TrackDeltaBatch message. Does not implicitly {@link harpy.v1.TrackDeltaBatch.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {harpy.v1.ITrackDeltaBatch} message TrackDeltaBatch message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TrackDeltaBatch.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.deltas != null && message.deltas.length)
                    for (let i = 0; i < message.deltas.length; ++i)
                        $root.harpy.v1.TrackDelta.encode(message.deltas[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified TrackDeltaBatch message, length delimited. Does not implicitly {@link harpy.v1.TrackDeltaBatch.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {harpy.v1.ITrackDeltaBatch} message TrackDeltaBatch message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TrackDeltaBatch.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a TrackDeltaBatch message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.TrackDeltaBatch} TrackDeltaBatch
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TrackDeltaBatch.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.TrackDeltaBatch();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.deltas && message.deltas.length))
                                message.deltas = [];
                            message.deltas.push($root.harpy.v1.TrackDelta.decode(reader, reader.uint32()));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a TrackDeltaBatch message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.TrackDeltaBatch} TrackDeltaBatch
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TrackDeltaBatch.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a TrackDeltaBatch message.
             * @function verify
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            TrackDeltaBatch.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.deltas != null && message.hasOwnProperty("deltas")) {
                    if (!Array.isArray(message.deltas))
                        return "deltas: array expected";
                    for (let i = 0; i < message.deltas.length; ++i) {
                        let error = $root.harpy.v1.TrackDelta.verify(message.deltas[i]);
                        if (error)
                            return "deltas." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a TrackDeltaBatch message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.TrackDeltaBatch} TrackDeltaBatch
             */
            TrackDeltaBatch.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.TrackDeltaBatch)
                    return object;
                let message = new $root.harpy.v1.TrackDeltaBatch();
                if (object.deltas) {
                    if (!Array.isArray(object.deltas))
                        throw TypeError(".harpy.v1.TrackDeltaBatch.deltas: array expected");
                    message.deltas = [];
                    for (let i = 0; i < object.deltas.length; ++i) {
                        if (typeof object.deltas[i] !== "object")
                            throw TypeError(".harpy.v1.TrackDeltaBatch.deltas: object expected");
                        message.deltas[i] = $root.harpy.v1.TrackDelta.fromObject(object.deltas[i]);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a TrackDeltaBatch message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {harpy.v1.TrackDeltaBatch} message TrackDeltaBatch
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            TrackDeltaBatch.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.deltas = [];
                if (message.deltas && message.deltas.length) {
                    object.deltas = [];
                    for (let j = 0; j < message.deltas.length; ++j)
                        object.deltas[j] = $root.harpy.v1.TrackDelta.toObject(message.deltas[j], options);
                }
                return object;
            };

            /**
             * Converts this TrackDeltaBatch to JSON.
             * @function toJSON
             * @memberof harpy.v1.TrackDeltaBatch
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            TrackDeltaBatch.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for TrackDeltaBatch
             * @function getTypeUrl
             * @memberof harpy.v1.TrackDeltaBatch
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            TrackDeltaBatch.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.TrackDeltaBatch";
            };

            return TrackDeltaBatch;
        })();

        v1.TrackDelta = (function() {

            /**
             * Properties of a TrackDelta.
             * @memberof harpy.v1
             * @interface ITrackDelta
             * @property {string|null} [id] TrackDelta id
             * @property {harpy.v1.TrackKind|null} [kind] TrackDelta kind
             * @property {harpy.v1.IPosition|null} [position] TrackDelta position
             * @property {number|null} [heading] TrackDelta heading
             * @property {number|null} [speed] TrackDelta speed
             * @property {number|Long|null} [tsMs] TrackDelta tsMs
             * @property {string|null} [providerId] TrackDelta providerId
             * @property {Object.<string,string>|null} [meta] TrackDelta meta
             */

            /**
             * Constructs a new TrackDelta.
             * @memberof harpy.v1
             * @classdesc Represents a TrackDelta.
             * @implements ITrackDelta
             * @constructor
             * @param {harpy.v1.ITrackDelta=} [properties] Properties to set
             */
            function TrackDelta(properties) {
                this.meta = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * TrackDelta id.
             * @member {string} id
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.id = "";

            /**
             * TrackDelta kind.
             * @member {harpy.v1.TrackKind} kind
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.kind = 0;

            /**
             * TrackDelta position.
             * @member {harpy.v1.IPosition|null|undefined} position
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.position = null;

            /**
             * TrackDelta heading.
             * @member {number} heading
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.heading = 0;

            /**
             * TrackDelta speed.
             * @member {number} speed
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.speed = 0;

            /**
             * TrackDelta tsMs.
             * @member {number|Long} tsMs
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.tsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * TrackDelta providerId.
             * @member {string} providerId
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.providerId = "";

            /**
             * TrackDelta meta.
             * @member {Object.<string,string>} meta
             * @memberof harpy.v1.TrackDelta
             * @instance
             */
            TrackDelta.prototype.meta = $util.emptyObject;

            /**
             * Creates a new TrackDelta instance using the specified properties.
             * @function create
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {harpy.v1.ITrackDelta=} [properties] Properties to set
             * @returns {harpy.v1.TrackDelta} TrackDelta instance
             */
            TrackDelta.create = function create(properties) {
                return new TrackDelta(properties);
            };

            /**
             * Encodes the specified TrackDelta message. Does not implicitly {@link harpy.v1.TrackDelta.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {harpy.v1.ITrackDelta} message TrackDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TrackDelta.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.kind != null && Object.hasOwnProperty.call(message, "kind"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.kind);
                if (message.position != null && Object.hasOwnProperty.call(message, "position"))
                    $root.harpy.v1.Position.encode(message.position, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                if (message.heading != null && Object.hasOwnProperty.call(message, "heading"))
                    writer.uint32(/* id 4, wireType 1 =*/33).double(message.heading);
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
                    writer.uint32(/* id 5, wireType 1 =*/41).double(message.speed);
                if (message.tsMs != null && Object.hasOwnProperty.call(message, "tsMs"))
                    writer.uint32(/* id 6, wireType 0 =*/48).uint64(message.tsMs);
                if (message.providerId != null && Object.hasOwnProperty.call(message, "providerId"))
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.providerId);
                if (message.meta != null && Object.hasOwnProperty.call(message, "meta"))
                    for (let keys = Object.keys(message.meta), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 8, wireType 2 =*/66).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.meta[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified TrackDelta message, length delimited. Does not implicitly {@link harpy.v1.TrackDelta.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {harpy.v1.ITrackDelta} message TrackDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TrackDelta.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a TrackDelta message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.TrackDelta} TrackDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TrackDelta.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.TrackDelta(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.kind = reader.int32();
                            break;
                        }
                    case 3: {
                            message.position = $root.harpy.v1.Position.decode(reader, reader.uint32());
                            break;
                        }
                    case 4: {
                            message.heading = reader.double();
                            break;
                        }
                    case 5: {
                            message.speed = reader.double();
                            break;
                        }
                    case 6: {
                            message.tsMs = reader.uint64();
                            break;
                        }
                    case 7: {
                            message.providerId = reader.string();
                            break;
                        }
                    case 8: {
                            if (message.meta === $util.emptyObject)
                                message.meta = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.string();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.meta[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a TrackDelta message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.TrackDelta} TrackDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TrackDelta.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a TrackDelta message.
             * @function verify
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            TrackDelta.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.kind != null && message.hasOwnProperty("kind"))
                    switch (message.kind) {
                    default:
                        return "kind: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        break;
                    }
                if (message.position != null && message.hasOwnProperty("position")) {
                    let error = $root.harpy.v1.Position.verify(message.position);
                    if (error)
                        return "position." + error;
                }
                if (message.heading != null && message.hasOwnProperty("heading"))
                    if (typeof message.heading !== "number")
                        return "heading: number expected";
                if (message.speed != null && message.hasOwnProperty("speed"))
                    if (typeof message.speed !== "number")
                        return "speed: number expected";
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (!$util.isInteger(message.tsMs) && !(message.tsMs && $util.isInteger(message.tsMs.low) && $util.isInteger(message.tsMs.high)))
                        return "tsMs: integer|Long expected";
                if (message.providerId != null && message.hasOwnProperty("providerId"))
                    if (!$util.isString(message.providerId))
                        return "providerId: string expected";
                if (message.meta != null && message.hasOwnProperty("meta")) {
                    if (!$util.isObject(message.meta))
                        return "meta: object expected";
                    let key = Object.keys(message.meta);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.meta[key[i]]))
                            return "meta: string{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a TrackDelta message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.TrackDelta} TrackDelta
             */
            TrackDelta.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.TrackDelta)
                    return object;
                let message = new $root.harpy.v1.TrackDelta();
                if (object.id != null)
                    message.id = String(object.id);
                switch (object.kind) {
                default:
                    if (typeof object.kind === "number") {
                        message.kind = object.kind;
                        break;
                    }
                    break;
                case "TRACK_KIND_UNSPECIFIED":
                case 0:
                    message.kind = 0;
                    break;
                case "TRACK_KIND_AIRCRAFT":
                case 1:
                    message.kind = 1;
                    break;
                case "TRACK_KIND_SATELLITE":
                case 2:
                    message.kind = 2;
                    break;
                case "TRACK_KIND_GROUND":
                case 3:
                    message.kind = 3;
                    break;
                case "TRACK_KIND_VESSEL":
                case 4:
                    message.kind = 4;
                    break;
                }
                if (object.position != null) {
                    if (typeof object.position !== "object")
                        throw TypeError(".harpy.v1.TrackDelta.position: object expected");
                    message.position = $root.harpy.v1.Position.fromObject(object.position);
                }
                if (object.heading != null)
                    message.heading = Number(object.heading);
                if (object.speed != null)
                    message.speed = Number(object.speed);
                if (object.tsMs != null)
                    if ($util.Long)
                        (message.tsMs = $util.Long.fromValue(object.tsMs)).unsigned = true;
                    else if (typeof object.tsMs === "string")
                        message.tsMs = parseInt(object.tsMs, 10);
                    else if (typeof object.tsMs === "number")
                        message.tsMs = object.tsMs;
                    else if (typeof object.tsMs === "object")
                        message.tsMs = new $util.LongBits(object.tsMs.low >>> 0, object.tsMs.high >>> 0).toNumber(true);
                if (object.providerId != null)
                    message.providerId = String(object.providerId);
                if (object.meta) {
                    if (typeof object.meta !== "object")
                        throw TypeError(".harpy.v1.TrackDelta.meta: object expected");
                    message.meta = {};
                    for (let keys = Object.keys(object.meta), i = 0; i < keys.length; ++i)
                        message.meta[keys[i]] = String(object.meta[keys[i]]);
                }
                return message;
            };

            /**
             * Creates a plain object from a TrackDelta message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {harpy.v1.TrackDelta} message TrackDelta
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            TrackDelta.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.objects || options.defaults)
                    object.meta = {};
                if (options.defaults) {
                    object.id = "";
                    object.kind = options.enums === String ? "TRACK_KIND_UNSPECIFIED" : 0;
                    object.position = null;
                    object.heading = 0;
                    object.speed = 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.tsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.tsMs = options.longs === String ? "0" : 0;
                    object.providerId = "";
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.kind != null && message.hasOwnProperty("kind"))
                    object.kind = options.enums === String ? $root.harpy.v1.TrackKind[message.kind] === undefined ? message.kind : $root.harpy.v1.TrackKind[message.kind] : message.kind;
                if (message.position != null && message.hasOwnProperty("position"))
                    object.position = $root.harpy.v1.Position.toObject(message.position, options);
                if (message.heading != null && message.hasOwnProperty("heading"))
                    object.heading = options.json && !isFinite(message.heading) ? String(message.heading) : message.heading;
                if (message.speed != null && message.hasOwnProperty("speed"))
                    object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (typeof message.tsMs === "number")
                        object.tsMs = options.longs === String ? String(message.tsMs) : message.tsMs;
                    else
                        object.tsMs = options.longs === String ? $util.Long.prototype.toString.call(message.tsMs) : options.longs === Number ? new $util.LongBits(message.tsMs.low >>> 0, message.tsMs.high >>> 0).toNumber(true) : message.tsMs;
                if (message.providerId != null && message.hasOwnProperty("providerId"))
                    object.providerId = message.providerId;
                let keys2;
                if (message.meta && (keys2 = Object.keys(message.meta)).length) {
                    object.meta = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.meta[keys2[j]] = message.meta[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this TrackDelta to JSON.
             * @function toJSON
             * @memberof harpy.v1.TrackDelta
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            TrackDelta.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for TrackDelta
             * @function getTypeUrl
             * @memberof harpy.v1.TrackDelta
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            TrackDelta.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.TrackDelta";
            };

            return TrackDelta;
        })();

        /**
         * TrackKind enum.
         * @name harpy.v1.TrackKind
         * @enum {number}
         * @property {number} TRACK_KIND_UNSPECIFIED=0 TRACK_KIND_UNSPECIFIED value
         * @property {number} TRACK_KIND_AIRCRAFT=1 TRACK_KIND_AIRCRAFT value
         * @property {number} TRACK_KIND_SATELLITE=2 TRACK_KIND_SATELLITE value
         * @property {number} TRACK_KIND_GROUND=3 TRACK_KIND_GROUND value
         * @property {number} TRACK_KIND_VESSEL=4 TRACK_KIND_VESSEL value
         */
        v1.TrackKind = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "TRACK_KIND_UNSPECIFIED"] = 0;
            values[valuesById[1] = "TRACK_KIND_AIRCRAFT"] = 1;
            values[valuesById[2] = "TRACK_KIND_SATELLITE"] = 2;
            values[valuesById[3] = "TRACK_KIND_GROUND"] = 3;
            values[valuesById[4] = "TRACK_KIND_VESSEL"] = 4;
            return values;
        })();

        v1.Position = (function() {

            /**
             * Properties of a Position.
             * @memberof harpy.v1
             * @interface IPosition
             * @property {number|null} [lat] Position lat
             * @property {number|null} [lon] Position lon
             * @property {number|null} [alt] Position alt
             */

            /**
             * Constructs a new Position.
             * @memberof harpy.v1
             * @classdesc Represents a Position.
             * @implements IPosition
             * @constructor
             * @param {harpy.v1.IPosition=} [properties] Properties to set
             */
            function Position(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Position lat.
             * @member {number} lat
             * @memberof harpy.v1.Position
             * @instance
             */
            Position.prototype.lat = 0;

            /**
             * Position lon.
             * @member {number} lon
             * @memberof harpy.v1.Position
             * @instance
             */
            Position.prototype.lon = 0;

            /**
             * Position alt.
             * @member {number} alt
             * @memberof harpy.v1.Position
             * @instance
             */
            Position.prototype.alt = 0;

            /**
             * Creates a new Position instance using the specified properties.
             * @function create
             * @memberof harpy.v1.Position
             * @static
             * @param {harpy.v1.IPosition=} [properties] Properties to set
             * @returns {harpy.v1.Position} Position instance
             */
            Position.create = function create(properties) {
                return new Position(properties);
            };

            /**
             * Encodes the specified Position message. Does not implicitly {@link harpy.v1.Position.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.Position
             * @static
             * @param {harpy.v1.IPosition} message Position message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Position.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.lat != null && Object.hasOwnProperty.call(message, "lat"))
                    writer.uint32(/* id 1, wireType 1 =*/9).double(message.lat);
                if (message.lon != null && Object.hasOwnProperty.call(message, "lon"))
                    writer.uint32(/* id 2, wireType 1 =*/17).double(message.lon);
                if (message.alt != null && Object.hasOwnProperty.call(message, "alt"))
                    writer.uint32(/* id 3, wireType 1 =*/25).double(message.alt);
                return writer;
            };

            /**
             * Encodes the specified Position message, length delimited. Does not implicitly {@link harpy.v1.Position.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.Position
             * @static
             * @param {harpy.v1.IPosition} message Position message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Position.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Position message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.Position
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.Position} Position
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Position.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.Position();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.lat = reader.double();
                            break;
                        }
                    case 2: {
                            message.lon = reader.double();
                            break;
                        }
                    case 3: {
                            message.alt = reader.double();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Position message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.Position
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.Position} Position
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Position.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Position message.
             * @function verify
             * @memberof harpy.v1.Position
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Position.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.lat != null && message.hasOwnProperty("lat"))
                    if (typeof message.lat !== "number")
                        return "lat: number expected";
                if (message.lon != null && message.hasOwnProperty("lon"))
                    if (typeof message.lon !== "number")
                        return "lon: number expected";
                if (message.alt != null && message.hasOwnProperty("alt"))
                    if (typeof message.alt !== "number")
                        return "alt: number expected";
                return null;
            };

            /**
             * Creates a Position message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.Position
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.Position} Position
             */
            Position.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.Position)
                    return object;
                let message = new $root.harpy.v1.Position();
                if (object.lat != null)
                    message.lat = Number(object.lat);
                if (object.lon != null)
                    message.lon = Number(object.lon);
                if (object.alt != null)
                    message.alt = Number(object.alt);
                return message;
            };

            /**
             * Creates a plain object from a Position message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.Position
             * @static
             * @param {harpy.v1.Position} message Position
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Position.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.lat = 0;
                    object.lon = 0;
                    object.alt = 0;
                }
                if (message.lat != null && message.hasOwnProperty("lat"))
                    object.lat = options.json && !isFinite(message.lat) ? String(message.lat) : message.lat;
                if (message.lon != null && message.hasOwnProperty("lon"))
                    object.lon = options.json && !isFinite(message.lon) ? String(message.lon) : message.lon;
                if (message.alt != null && message.hasOwnProperty("alt"))
                    object.alt = options.json && !isFinite(message.alt) ? String(message.alt) : message.alt;
                return object;
            };

            /**
             * Converts this Position to JSON.
             * @function toJSON
             * @memberof harpy.v1.Position
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Position.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Position
             * @function getTypeUrl
             * @memberof harpy.v1.Position
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Position.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.Position";
            };

            return Position;
        })();

        v1.AlertUpsert = (function() {

            /**
             * Properties of an AlertUpsert.
             * @memberof harpy.v1
             * @interface IAlertUpsert
             * @property {string|null} [id] AlertUpsert id
             * @property {harpy.v1.AlertSeverity|null} [severity] AlertUpsert severity
             * @property {string|null} [title] AlertUpsert title
             * @property {string|null} [description] AlertUpsert description
             * @property {number|Long|null} [tsMs] AlertUpsert tsMs
             * @property {Array.<string>|null} [evidenceLinkIds] AlertUpsert evidenceLinkIds
             * @property {harpy.v1.AlertStatus|null} [status] AlertUpsert status
             * @property {Object.<string,string>|null} [meta] AlertUpsert meta
             */

            /**
             * Constructs a new AlertUpsert.
             * @memberof harpy.v1
             * @classdesc Represents an AlertUpsert.
             * @implements IAlertUpsert
             * @constructor
             * @param {harpy.v1.IAlertUpsert=} [properties] Properties to set
             */
            function AlertUpsert(properties) {
                this.evidenceLinkIds = [];
                this.meta = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * AlertUpsert id.
             * @member {string} id
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.id = "";

            /**
             * AlertUpsert severity.
             * @member {harpy.v1.AlertSeverity} severity
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.severity = 0;

            /**
             * AlertUpsert title.
             * @member {string} title
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.title = "";

            /**
             * AlertUpsert description.
             * @member {string} description
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.description = "";

            /**
             * AlertUpsert tsMs.
             * @member {number|Long} tsMs
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.tsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * AlertUpsert evidenceLinkIds.
             * @member {Array.<string>} evidenceLinkIds
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.evidenceLinkIds = $util.emptyArray;

            /**
             * AlertUpsert status.
             * @member {harpy.v1.AlertStatus} status
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.status = 0;

            /**
             * AlertUpsert meta.
             * @member {Object.<string,string>} meta
             * @memberof harpy.v1.AlertUpsert
             * @instance
             */
            AlertUpsert.prototype.meta = $util.emptyObject;

            /**
             * Creates a new AlertUpsert instance using the specified properties.
             * @function create
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {harpy.v1.IAlertUpsert=} [properties] Properties to set
             * @returns {harpy.v1.AlertUpsert} AlertUpsert instance
             */
            AlertUpsert.create = function create(properties) {
                return new AlertUpsert(properties);
            };

            /**
             * Encodes the specified AlertUpsert message. Does not implicitly {@link harpy.v1.AlertUpsert.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {harpy.v1.IAlertUpsert} message AlertUpsert message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AlertUpsert.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.severity != null && Object.hasOwnProperty.call(message, "severity"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.severity);
                if (message.title != null && Object.hasOwnProperty.call(message, "title"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.title);
                if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.description);
                if (message.tsMs != null && Object.hasOwnProperty.call(message, "tsMs"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.tsMs);
                if (message.evidenceLinkIds != null && message.evidenceLinkIds.length)
                    for (let i = 0; i < message.evidenceLinkIds.length; ++i)
                        writer.uint32(/* id 6, wireType 2 =*/50).string(message.evidenceLinkIds[i]);
                if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                    writer.uint32(/* id 7, wireType 0 =*/56).int32(message.status);
                if (message.meta != null && Object.hasOwnProperty.call(message, "meta"))
                    for (let keys = Object.keys(message.meta), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 8, wireType 2 =*/66).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.meta[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified AlertUpsert message, length delimited. Does not implicitly {@link harpy.v1.AlertUpsert.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {harpy.v1.IAlertUpsert} message AlertUpsert message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AlertUpsert.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an AlertUpsert message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.AlertUpsert} AlertUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AlertUpsert.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.AlertUpsert(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.severity = reader.int32();
                            break;
                        }
                    case 3: {
                            message.title = reader.string();
                            break;
                        }
                    case 4: {
                            message.description = reader.string();
                            break;
                        }
                    case 5: {
                            message.tsMs = reader.uint64();
                            break;
                        }
                    case 6: {
                            if (!(message.evidenceLinkIds && message.evidenceLinkIds.length))
                                message.evidenceLinkIds = [];
                            message.evidenceLinkIds.push(reader.string());
                            break;
                        }
                    case 7: {
                            message.status = reader.int32();
                            break;
                        }
                    case 8: {
                            if (message.meta === $util.emptyObject)
                                message.meta = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.string();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.meta[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an AlertUpsert message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.AlertUpsert} AlertUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AlertUpsert.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an AlertUpsert message.
             * @function verify
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            AlertUpsert.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.severity != null && message.hasOwnProperty("severity"))
                    switch (message.severity) {
                    default:
                        return "severity: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                if (message.title != null && message.hasOwnProperty("title"))
                    if (!$util.isString(message.title))
                        return "title: string expected";
                if (message.description != null && message.hasOwnProperty("description"))
                    if (!$util.isString(message.description))
                        return "description: string expected";
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (!$util.isInteger(message.tsMs) && !(message.tsMs && $util.isInteger(message.tsMs.low) && $util.isInteger(message.tsMs.high)))
                        return "tsMs: integer|Long expected";
                if (message.evidenceLinkIds != null && message.hasOwnProperty("evidenceLinkIds")) {
                    if (!Array.isArray(message.evidenceLinkIds))
                        return "evidenceLinkIds: array expected";
                    for (let i = 0; i < message.evidenceLinkIds.length; ++i)
                        if (!$util.isString(message.evidenceLinkIds[i]))
                            return "evidenceLinkIds: string[] expected";
                }
                if (message.status != null && message.hasOwnProperty("status"))
                    switch (message.status) {
                    default:
                        return "status: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                if (message.meta != null && message.hasOwnProperty("meta")) {
                    if (!$util.isObject(message.meta))
                        return "meta: object expected";
                    let key = Object.keys(message.meta);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.meta[key[i]]))
                            return "meta: string{k:string} expected";
                }
                return null;
            };

            /**
             * Creates an AlertUpsert message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.AlertUpsert} AlertUpsert
             */
            AlertUpsert.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.AlertUpsert)
                    return object;
                let message = new $root.harpy.v1.AlertUpsert();
                if (object.id != null)
                    message.id = String(object.id);
                switch (object.severity) {
                default:
                    if (typeof object.severity === "number") {
                        message.severity = object.severity;
                        break;
                    }
                    break;
                case "ALERT_SEVERITY_UNSPECIFIED":
                case 0:
                    message.severity = 0;
                    break;
                case "ALERT_SEVERITY_INFO":
                case 1:
                    message.severity = 1;
                    break;
                case "ALERT_SEVERITY_WARNING":
                case 2:
                    message.severity = 2;
                    break;
                case "ALERT_SEVERITY_CRITICAL":
                case 3:
                    message.severity = 3;
                    break;
                }
                if (object.title != null)
                    message.title = String(object.title);
                if (object.description != null)
                    message.description = String(object.description);
                if (object.tsMs != null)
                    if ($util.Long)
                        (message.tsMs = $util.Long.fromValue(object.tsMs)).unsigned = true;
                    else if (typeof object.tsMs === "string")
                        message.tsMs = parseInt(object.tsMs, 10);
                    else if (typeof object.tsMs === "number")
                        message.tsMs = object.tsMs;
                    else if (typeof object.tsMs === "object")
                        message.tsMs = new $util.LongBits(object.tsMs.low >>> 0, object.tsMs.high >>> 0).toNumber(true);
                if (object.evidenceLinkIds) {
                    if (!Array.isArray(object.evidenceLinkIds))
                        throw TypeError(".harpy.v1.AlertUpsert.evidenceLinkIds: array expected");
                    message.evidenceLinkIds = [];
                    for (let i = 0; i < object.evidenceLinkIds.length; ++i)
                        message.evidenceLinkIds[i] = String(object.evidenceLinkIds[i]);
                }
                switch (object.status) {
                default:
                    if (typeof object.status === "number") {
                        message.status = object.status;
                        break;
                    }
                    break;
                case "ALERT_STATUS_UNSPECIFIED":
                case 0:
                    message.status = 0;
                    break;
                case "ALERT_STATUS_ACTIVE":
                case 1:
                    message.status = 1;
                    break;
                case "ALERT_STATUS_RESOLVED":
                case 2:
                    message.status = 2;
                    break;
                case "ALERT_STATUS_ACKNOWLEDGED":
                case 3:
                    message.status = 3;
                    break;
                }
                if (object.meta) {
                    if (typeof object.meta !== "object")
                        throw TypeError(".harpy.v1.AlertUpsert.meta: object expected");
                    message.meta = {};
                    for (let keys = Object.keys(object.meta), i = 0; i < keys.length; ++i)
                        message.meta[keys[i]] = String(object.meta[keys[i]]);
                }
                return message;
            };

            /**
             * Creates a plain object from an AlertUpsert message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {harpy.v1.AlertUpsert} message AlertUpsert
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            AlertUpsert.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.evidenceLinkIds = [];
                if (options.objects || options.defaults)
                    object.meta = {};
                if (options.defaults) {
                    object.id = "";
                    object.severity = options.enums === String ? "ALERT_SEVERITY_UNSPECIFIED" : 0;
                    object.title = "";
                    object.description = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.tsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.tsMs = options.longs === String ? "0" : 0;
                    object.status = options.enums === String ? "ALERT_STATUS_UNSPECIFIED" : 0;
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.severity != null && message.hasOwnProperty("severity"))
                    object.severity = options.enums === String ? $root.harpy.v1.AlertSeverity[message.severity] === undefined ? message.severity : $root.harpy.v1.AlertSeverity[message.severity] : message.severity;
                if (message.title != null && message.hasOwnProperty("title"))
                    object.title = message.title;
                if (message.description != null && message.hasOwnProperty("description"))
                    object.description = message.description;
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (typeof message.tsMs === "number")
                        object.tsMs = options.longs === String ? String(message.tsMs) : message.tsMs;
                    else
                        object.tsMs = options.longs === String ? $util.Long.prototype.toString.call(message.tsMs) : options.longs === Number ? new $util.LongBits(message.tsMs.low >>> 0, message.tsMs.high >>> 0).toNumber(true) : message.tsMs;
                if (message.evidenceLinkIds && message.evidenceLinkIds.length) {
                    object.evidenceLinkIds = [];
                    for (let j = 0; j < message.evidenceLinkIds.length; ++j)
                        object.evidenceLinkIds[j] = message.evidenceLinkIds[j];
                }
                if (message.status != null && message.hasOwnProperty("status"))
                    object.status = options.enums === String ? $root.harpy.v1.AlertStatus[message.status] === undefined ? message.status : $root.harpy.v1.AlertStatus[message.status] : message.status;
                let keys2;
                if (message.meta && (keys2 = Object.keys(message.meta)).length) {
                    object.meta = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.meta[keys2[j]] = message.meta[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this AlertUpsert to JSON.
             * @function toJSON
             * @memberof harpy.v1.AlertUpsert
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            AlertUpsert.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for AlertUpsert
             * @function getTypeUrl
             * @memberof harpy.v1.AlertUpsert
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            AlertUpsert.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.AlertUpsert";
            };

            return AlertUpsert;
        })();

        /**
         * AlertSeverity enum.
         * @name harpy.v1.AlertSeverity
         * @enum {number}
         * @property {number} ALERT_SEVERITY_UNSPECIFIED=0 ALERT_SEVERITY_UNSPECIFIED value
         * @property {number} ALERT_SEVERITY_INFO=1 ALERT_SEVERITY_INFO value
         * @property {number} ALERT_SEVERITY_WARNING=2 ALERT_SEVERITY_WARNING value
         * @property {number} ALERT_SEVERITY_CRITICAL=3 ALERT_SEVERITY_CRITICAL value
         */
        v1.AlertSeverity = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "ALERT_SEVERITY_UNSPECIFIED"] = 0;
            values[valuesById[1] = "ALERT_SEVERITY_INFO"] = 1;
            values[valuesById[2] = "ALERT_SEVERITY_WARNING"] = 2;
            values[valuesById[3] = "ALERT_SEVERITY_CRITICAL"] = 3;
            return values;
        })();

        /**
         * AlertStatus enum.
         * @name harpy.v1.AlertStatus
         * @enum {number}
         * @property {number} ALERT_STATUS_UNSPECIFIED=0 ALERT_STATUS_UNSPECIFIED value
         * @property {number} ALERT_STATUS_ACTIVE=1 ALERT_STATUS_ACTIVE value
         * @property {number} ALERT_STATUS_RESOLVED=2 ALERT_STATUS_RESOLVED value
         * @property {number} ALERT_STATUS_ACKNOWLEDGED=3 ALERT_STATUS_ACKNOWLEDGED value
         */
        v1.AlertStatus = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "ALERT_STATUS_UNSPECIFIED"] = 0;
            values[valuesById[1] = "ALERT_STATUS_ACTIVE"] = 1;
            values[valuesById[2] = "ALERT_STATUS_RESOLVED"] = 2;
            values[valuesById[3] = "ALERT_STATUS_ACKNOWLEDGED"] = 3;
            return values;
        })();

        v1.ProviderStatus = (function() {

            /**
             * Properties of a ProviderStatus.
             * @memberof harpy.v1
             * @interface IProviderStatus
             * @property {string|null} [providerId] ProviderStatus providerId
             * @property {harpy.v1.CircuitState|null} [circuitState] ProviderStatus circuitState
             * @property {harpy.v1.Freshness|null} [freshness] ProviderStatus freshness
             * @property {number|Long|null} [lastSuccessTsMs] ProviderStatus lastSuccessTsMs
             * @property {number|null} [failureCount] ProviderStatus failureCount
             * @property {string|null} [errorMessage] ProviderStatus errorMessage
             * @property {Object.<string,string>|null} [meta] ProviderStatus meta
             */

            /**
             * Constructs a new ProviderStatus.
             * @memberof harpy.v1
             * @classdesc Represents a ProviderStatus.
             * @implements IProviderStatus
             * @constructor
             * @param {harpy.v1.IProviderStatus=} [properties] Properties to set
             */
            function ProviderStatus(properties) {
                this.meta = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * ProviderStatus providerId.
             * @member {string} providerId
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.providerId = "";

            /**
             * ProviderStatus circuitState.
             * @member {harpy.v1.CircuitState} circuitState
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.circuitState = 0;

            /**
             * ProviderStatus freshness.
             * @member {harpy.v1.Freshness} freshness
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.freshness = 0;

            /**
             * ProviderStatus lastSuccessTsMs.
             * @member {number|Long} lastSuccessTsMs
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.lastSuccessTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * ProviderStatus failureCount.
             * @member {number} failureCount
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.failureCount = 0;

            /**
             * ProviderStatus errorMessage.
             * @member {string|null|undefined} errorMessage
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.errorMessage = null;

            /**
             * ProviderStatus meta.
             * @member {Object.<string,string>} meta
             * @memberof harpy.v1.ProviderStatus
             * @instance
             */
            ProviderStatus.prototype.meta = $util.emptyObject;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(ProviderStatus.prototype, "_errorMessage", {
                get: $util.oneOfGetter($oneOfFields = ["errorMessage"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new ProviderStatus instance using the specified properties.
             * @function create
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {harpy.v1.IProviderStatus=} [properties] Properties to set
             * @returns {harpy.v1.ProviderStatus} ProviderStatus instance
             */
            ProviderStatus.create = function create(properties) {
                return new ProviderStatus(properties);
            };

            /**
             * Encodes the specified ProviderStatus message. Does not implicitly {@link harpy.v1.ProviderStatus.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {harpy.v1.IProviderStatus} message ProviderStatus message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ProviderStatus.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.providerId != null && Object.hasOwnProperty.call(message, "providerId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.providerId);
                if (message.circuitState != null && Object.hasOwnProperty.call(message, "circuitState"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.circuitState);
                if (message.freshness != null && Object.hasOwnProperty.call(message, "freshness"))
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.freshness);
                if (message.lastSuccessTsMs != null && Object.hasOwnProperty.call(message, "lastSuccessTsMs"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.lastSuccessTsMs);
                if (message.failureCount != null && Object.hasOwnProperty.call(message, "failureCount"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.failureCount);
                if (message.errorMessage != null && Object.hasOwnProperty.call(message, "errorMessage"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.errorMessage);
                if (message.meta != null && Object.hasOwnProperty.call(message, "meta"))
                    for (let keys = Object.keys(message.meta), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 7, wireType 2 =*/58).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.meta[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified ProviderStatus message, length delimited. Does not implicitly {@link harpy.v1.ProviderStatus.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {harpy.v1.IProviderStatus} message ProviderStatus message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ProviderStatus.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a ProviderStatus message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.ProviderStatus} ProviderStatus
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ProviderStatus.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.ProviderStatus(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.providerId = reader.string();
                            break;
                        }
                    case 2: {
                            message.circuitState = reader.int32();
                            break;
                        }
                    case 3: {
                            message.freshness = reader.int32();
                            break;
                        }
                    case 4: {
                            message.lastSuccessTsMs = reader.uint64();
                            break;
                        }
                    case 5: {
                            message.failureCount = reader.uint32();
                            break;
                        }
                    case 6: {
                            message.errorMessage = reader.string();
                            break;
                        }
                    case 7: {
                            if (message.meta === $util.emptyObject)
                                message.meta = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.string();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.meta[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a ProviderStatus message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.ProviderStatus} ProviderStatus
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ProviderStatus.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a ProviderStatus message.
             * @function verify
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            ProviderStatus.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.providerId != null && message.hasOwnProperty("providerId"))
                    if (!$util.isString(message.providerId))
                        return "providerId: string expected";
                if (message.circuitState != null && message.hasOwnProperty("circuitState"))
                    switch (message.circuitState) {
                    default:
                        return "circuitState: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                if (message.freshness != null && message.hasOwnProperty("freshness"))
                    switch (message.freshness) {
                    default:
                        return "freshness: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        break;
                    }
                if (message.lastSuccessTsMs != null && message.hasOwnProperty("lastSuccessTsMs"))
                    if (!$util.isInteger(message.lastSuccessTsMs) && !(message.lastSuccessTsMs && $util.isInteger(message.lastSuccessTsMs.low) && $util.isInteger(message.lastSuccessTsMs.high)))
                        return "lastSuccessTsMs: integer|Long expected";
                if (message.failureCount != null && message.hasOwnProperty("failureCount"))
                    if (!$util.isInteger(message.failureCount))
                        return "failureCount: integer expected";
                if (message.errorMessage != null && message.hasOwnProperty("errorMessage")) {
                    properties._errorMessage = 1;
                    if (!$util.isString(message.errorMessage))
                        return "errorMessage: string expected";
                }
                if (message.meta != null && message.hasOwnProperty("meta")) {
                    if (!$util.isObject(message.meta))
                        return "meta: object expected";
                    let key = Object.keys(message.meta);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.meta[key[i]]))
                            return "meta: string{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a ProviderStatus message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.ProviderStatus} ProviderStatus
             */
            ProviderStatus.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.ProviderStatus)
                    return object;
                let message = new $root.harpy.v1.ProviderStatus();
                if (object.providerId != null)
                    message.providerId = String(object.providerId);
                switch (object.circuitState) {
                default:
                    if (typeof object.circuitState === "number") {
                        message.circuitState = object.circuitState;
                        break;
                    }
                    break;
                case "CIRCUIT_STATE_UNSPECIFIED":
                case 0:
                    message.circuitState = 0;
                    break;
                case "CIRCUIT_STATE_CLOSED":
                case 1:
                    message.circuitState = 1;
                    break;
                case "CIRCUIT_STATE_OPEN":
                case 2:
                    message.circuitState = 2;
                    break;
                case "CIRCUIT_STATE_HALF_OPEN":
                case 3:
                    message.circuitState = 3;
                    break;
                }
                switch (object.freshness) {
                default:
                    if (typeof object.freshness === "number") {
                        message.freshness = object.freshness;
                        break;
                    }
                    break;
                case "FRESHNESS_UNSPECIFIED":
                case 0:
                    message.freshness = 0;
                    break;
                case "FRESHNESS_FRESH":
                case 1:
                    message.freshness = 1;
                    break;
                case "FRESHNESS_AGING":
                case 2:
                    message.freshness = 2;
                    break;
                case "FRESHNESS_STALE":
                case 3:
                    message.freshness = 3;
                    break;
                case "FRESHNESS_CRITICAL":
                case 4:
                    message.freshness = 4;
                    break;
                }
                if (object.lastSuccessTsMs != null)
                    if ($util.Long)
                        (message.lastSuccessTsMs = $util.Long.fromValue(object.lastSuccessTsMs)).unsigned = true;
                    else if (typeof object.lastSuccessTsMs === "string")
                        message.lastSuccessTsMs = parseInt(object.lastSuccessTsMs, 10);
                    else if (typeof object.lastSuccessTsMs === "number")
                        message.lastSuccessTsMs = object.lastSuccessTsMs;
                    else if (typeof object.lastSuccessTsMs === "object")
                        message.lastSuccessTsMs = new $util.LongBits(object.lastSuccessTsMs.low >>> 0, object.lastSuccessTsMs.high >>> 0).toNumber(true);
                if (object.failureCount != null)
                    message.failureCount = object.failureCount >>> 0;
                if (object.errorMessage != null)
                    message.errorMessage = String(object.errorMessage);
                if (object.meta) {
                    if (typeof object.meta !== "object")
                        throw TypeError(".harpy.v1.ProviderStatus.meta: object expected");
                    message.meta = {};
                    for (let keys = Object.keys(object.meta), i = 0; i < keys.length; ++i)
                        message.meta[keys[i]] = String(object.meta[keys[i]]);
                }
                return message;
            };

            /**
             * Creates a plain object from a ProviderStatus message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {harpy.v1.ProviderStatus} message ProviderStatus
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            ProviderStatus.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.objects || options.defaults)
                    object.meta = {};
                if (options.defaults) {
                    object.providerId = "";
                    object.circuitState = options.enums === String ? "CIRCUIT_STATE_UNSPECIFIED" : 0;
                    object.freshness = options.enums === String ? "FRESHNESS_UNSPECIFIED" : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.lastSuccessTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.lastSuccessTsMs = options.longs === String ? "0" : 0;
                    object.failureCount = 0;
                }
                if (message.providerId != null && message.hasOwnProperty("providerId"))
                    object.providerId = message.providerId;
                if (message.circuitState != null && message.hasOwnProperty("circuitState"))
                    object.circuitState = options.enums === String ? $root.harpy.v1.CircuitState[message.circuitState] === undefined ? message.circuitState : $root.harpy.v1.CircuitState[message.circuitState] : message.circuitState;
                if (message.freshness != null && message.hasOwnProperty("freshness"))
                    object.freshness = options.enums === String ? $root.harpy.v1.Freshness[message.freshness] === undefined ? message.freshness : $root.harpy.v1.Freshness[message.freshness] : message.freshness;
                if (message.lastSuccessTsMs != null && message.hasOwnProperty("lastSuccessTsMs"))
                    if (typeof message.lastSuccessTsMs === "number")
                        object.lastSuccessTsMs = options.longs === String ? String(message.lastSuccessTsMs) : message.lastSuccessTsMs;
                    else
                        object.lastSuccessTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.lastSuccessTsMs) : options.longs === Number ? new $util.LongBits(message.lastSuccessTsMs.low >>> 0, message.lastSuccessTsMs.high >>> 0).toNumber(true) : message.lastSuccessTsMs;
                if (message.failureCount != null && message.hasOwnProperty("failureCount"))
                    object.failureCount = message.failureCount;
                if (message.errorMessage != null && message.hasOwnProperty("errorMessage")) {
                    object.errorMessage = message.errorMessage;
                    if (options.oneofs)
                        object._errorMessage = "errorMessage";
                }
                let keys2;
                if (message.meta && (keys2 = Object.keys(message.meta)).length) {
                    object.meta = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.meta[keys2[j]] = message.meta[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this ProviderStatus to JSON.
             * @function toJSON
             * @memberof harpy.v1.ProviderStatus
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            ProviderStatus.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for ProviderStatus
             * @function getTypeUrl
             * @memberof harpy.v1.ProviderStatus
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            ProviderStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.ProviderStatus";
            };

            return ProviderStatus;
        })();

        /**
         * CircuitState enum.
         * @name harpy.v1.CircuitState
         * @enum {number}
         * @property {number} CIRCUIT_STATE_UNSPECIFIED=0 CIRCUIT_STATE_UNSPECIFIED value
         * @property {number} CIRCUIT_STATE_CLOSED=1 CIRCUIT_STATE_CLOSED value
         * @property {number} CIRCUIT_STATE_OPEN=2 CIRCUIT_STATE_OPEN value
         * @property {number} CIRCUIT_STATE_HALF_OPEN=3 CIRCUIT_STATE_HALF_OPEN value
         */
        v1.CircuitState = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "CIRCUIT_STATE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "CIRCUIT_STATE_CLOSED"] = 1;
            values[valuesById[2] = "CIRCUIT_STATE_OPEN"] = 2;
            values[valuesById[3] = "CIRCUIT_STATE_HALF_OPEN"] = 3;
            return values;
        })();

        /**
         * Freshness enum.
         * @name harpy.v1.Freshness
         * @enum {number}
         * @property {number} FRESHNESS_UNSPECIFIED=0 FRESHNESS_UNSPECIFIED value
         * @property {number} FRESHNESS_FRESH=1 FRESHNESS_FRESH value
         * @property {number} FRESHNESS_AGING=2 FRESHNESS_AGING value
         * @property {number} FRESHNESS_STALE=3 FRESHNESS_STALE value
         * @property {number} FRESHNESS_CRITICAL=4 FRESHNESS_CRITICAL value
         */
        v1.Freshness = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "FRESHNESS_UNSPECIFIED"] = 0;
            values[valuesById[1] = "FRESHNESS_FRESH"] = 1;
            values[valuesById[2] = "FRESHNESS_AGING"] = 2;
            values[valuesById[3] = "FRESHNESS_STALE"] = 3;
            values[valuesById[4] = "FRESHNESS_CRITICAL"] = 4;
            return values;
        })();

        v1.SnapshotMeta = (function() {

            /**
             * Properties of a SnapshotMeta.
             * @memberof harpy.v1
             * @interface ISnapshotMeta
             * @property {string|null} [snapshotId] SnapshotMeta snapshotId
             * @property {number|Long|null} [startTsMs] SnapshotMeta startTsMs
             * @property {number|Long|null} [endTsMs] SnapshotMeta endTsMs
             * @property {string|null} [s3Url] SnapshotMeta s3Url
             * @property {number|Long|null} [trackCount] SnapshotMeta trackCount
             * @property {number|Long|null} [compressedSizeBytes] SnapshotMeta compressedSizeBytes
             */

            /**
             * Constructs a new SnapshotMeta.
             * @memberof harpy.v1
             * @classdesc Represents a SnapshotMeta.
             * @implements ISnapshotMeta
             * @constructor
             * @param {harpy.v1.ISnapshotMeta=} [properties] Properties to set
             */
            function SnapshotMeta(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * SnapshotMeta snapshotId.
             * @member {string} snapshotId
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.snapshotId = "";

            /**
             * SnapshotMeta startTsMs.
             * @member {number|Long} startTsMs
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.startTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * SnapshotMeta endTsMs.
             * @member {number|Long} endTsMs
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.endTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * SnapshotMeta s3Url.
             * @member {string} s3Url
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.s3Url = "";

            /**
             * SnapshotMeta trackCount.
             * @member {number|Long} trackCount
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.trackCount = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * SnapshotMeta compressedSizeBytes.
             * @member {number|Long} compressedSizeBytes
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             */
            SnapshotMeta.prototype.compressedSizeBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * Creates a new SnapshotMeta instance using the specified properties.
             * @function create
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {harpy.v1.ISnapshotMeta=} [properties] Properties to set
             * @returns {harpy.v1.SnapshotMeta} SnapshotMeta instance
             */
            SnapshotMeta.create = function create(properties) {
                return new SnapshotMeta(properties);
            };

            /**
             * Encodes the specified SnapshotMeta message. Does not implicitly {@link harpy.v1.SnapshotMeta.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {harpy.v1.ISnapshotMeta} message SnapshotMeta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SnapshotMeta.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.snapshotId != null && Object.hasOwnProperty.call(message, "snapshotId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.snapshotId);
                if (message.startTsMs != null && Object.hasOwnProperty.call(message, "startTsMs"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.startTsMs);
                if (message.endTsMs != null && Object.hasOwnProperty.call(message, "endTsMs"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.endTsMs);
                if (message.s3Url != null && Object.hasOwnProperty.call(message, "s3Url"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.s3Url);
                if (message.trackCount != null && Object.hasOwnProperty.call(message, "trackCount"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.trackCount);
                if (message.compressedSizeBytes != null && Object.hasOwnProperty.call(message, "compressedSizeBytes"))
                    writer.uint32(/* id 6, wireType 0 =*/48).uint64(message.compressedSizeBytes);
                return writer;
            };

            /**
             * Encodes the specified SnapshotMeta message, length delimited. Does not implicitly {@link harpy.v1.SnapshotMeta.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {harpy.v1.ISnapshotMeta} message SnapshotMeta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SnapshotMeta.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a SnapshotMeta message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.SnapshotMeta} SnapshotMeta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SnapshotMeta.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.SnapshotMeta();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.snapshotId = reader.string();
                            break;
                        }
                    case 2: {
                            message.startTsMs = reader.uint64();
                            break;
                        }
                    case 3: {
                            message.endTsMs = reader.uint64();
                            break;
                        }
                    case 4: {
                            message.s3Url = reader.string();
                            break;
                        }
                    case 5: {
                            message.trackCount = reader.uint64();
                            break;
                        }
                    case 6: {
                            message.compressedSizeBytes = reader.uint64();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a SnapshotMeta message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.SnapshotMeta} SnapshotMeta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SnapshotMeta.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a SnapshotMeta message.
             * @function verify
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            SnapshotMeta.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.snapshotId != null && message.hasOwnProperty("snapshotId"))
                    if (!$util.isString(message.snapshotId))
                        return "snapshotId: string expected";
                if (message.startTsMs != null && message.hasOwnProperty("startTsMs"))
                    if (!$util.isInteger(message.startTsMs) && !(message.startTsMs && $util.isInteger(message.startTsMs.low) && $util.isInteger(message.startTsMs.high)))
                        return "startTsMs: integer|Long expected";
                if (message.endTsMs != null && message.hasOwnProperty("endTsMs"))
                    if (!$util.isInteger(message.endTsMs) && !(message.endTsMs && $util.isInteger(message.endTsMs.low) && $util.isInteger(message.endTsMs.high)))
                        return "endTsMs: integer|Long expected";
                if (message.s3Url != null && message.hasOwnProperty("s3Url"))
                    if (!$util.isString(message.s3Url))
                        return "s3Url: string expected";
                if (message.trackCount != null && message.hasOwnProperty("trackCount"))
                    if (!$util.isInteger(message.trackCount) && !(message.trackCount && $util.isInteger(message.trackCount.low) && $util.isInteger(message.trackCount.high)))
                        return "trackCount: integer|Long expected";
                if (message.compressedSizeBytes != null && message.hasOwnProperty("compressedSizeBytes"))
                    if (!$util.isInteger(message.compressedSizeBytes) && !(message.compressedSizeBytes && $util.isInteger(message.compressedSizeBytes.low) && $util.isInteger(message.compressedSizeBytes.high)))
                        return "compressedSizeBytes: integer|Long expected";
                return null;
            };

            /**
             * Creates a SnapshotMeta message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.SnapshotMeta} SnapshotMeta
             */
            SnapshotMeta.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.SnapshotMeta)
                    return object;
                let message = new $root.harpy.v1.SnapshotMeta();
                if (object.snapshotId != null)
                    message.snapshotId = String(object.snapshotId);
                if (object.startTsMs != null)
                    if ($util.Long)
                        (message.startTsMs = $util.Long.fromValue(object.startTsMs)).unsigned = true;
                    else if (typeof object.startTsMs === "string")
                        message.startTsMs = parseInt(object.startTsMs, 10);
                    else if (typeof object.startTsMs === "number")
                        message.startTsMs = object.startTsMs;
                    else if (typeof object.startTsMs === "object")
                        message.startTsMs = new $util.LongBits(object.startTsMs.low >>> 0, object.startTsMs.high >>> 0).toNumber(true);
                if (object.endTsMs != null)
                    if ($util.Long)
                        (message.endTsMs = $util.Long.fromValue(object.endTsMs)).unsigned = true;
                    else if (typeof object.endTsMs === "string")
                        message.endTsMs = parseInt(object.endTsMs, 10);
                    else if (typeof object.endTsMs === "number")
                        message.endTsMs = object.endTsMs;
                    else if (typeof object.endTsMs === "object")
                        message.endTsMs = new $util.LongBits(object.endTsMs.low >>> 0, object.endTsMs.high >>> 0).toNumber(true);
                if (object.s3Url != null)
                    message.s3Url = String(object.s3Url);
                if (object.trackCount != null)
                    if ($util.Long)
                        (message.trackCount = $util.Long.fromValue(object.trackCount)).unsigned = true;
                    else if (typeof object.trackCount === "string")
                        message.trackCount = parseInt(object.trackCount, 10);
                    else if (typeof object.trackCount === "number")
                        message.trackCount = object.trackCount;
                    else if (typeof object.trackCount === "object")
                        message.trackCount = new $util.LongBits(object.trackCount.low >>> 0, object.trackCount.high >>> 0).toNumber(true);
                if (object.compressedSizeBytes != null)
                    if ($util.Long)
                        (message.compressedSizeBytes = $util.Long.fromValue(object.compressedSizeBytes)).unsigned = true;
                    else if (typeof object.compressedSizeBytes === "string")
                        message.compressedSizeBytes = parseInt(object.compressedSizeBytes, 10);
                    else if (typeof object.compressedSizeBytes === "number")
                        message.compressedSizeBytes = object.compressedSizeBytes;
                    else if (typeof object.compressedSizeBytes === "object")
                        message.compressedSizeBytes = new $util.LongBits(object.compressedSizeBytes.low >>> 0, object.compressedSizeBytes.high >>> 0).toNumber(true);
                return message;
            };

            /**
             * Creates a plain object from a SnapshotMeta message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {harpy.v1.SnapshotMeta} message SnapshotMeta
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            SnapshotMeta.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.snapshotId = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.startTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.startTsMs = options.longs === String ? "0" : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.endTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.endTsMs = options.longs === String ? "0" : 0;
                    object.s3Url = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.trackCount = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.trackCount = options.longs === String ? "0" : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.compressedSizeBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.compressedSizeBytes = options.longs === String ? "0" : 0;
                }
                if (message.snapshotId != null && message.hasOwnProperty("snapshotId"))
                    object.snapshotId = message.snapshotId;
                if (message.startTsMs != null && message.hasOwnProperty("startTsMs"))
                    if (typeof message.startTsMs === "number")
                        object.startTsMs = options.longs === String ? String(message.startTsMs) : message.startTsMs;
                    else
                        object.startTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.startTsMs) : options.longs === Number ? new $util.LongBits(message.startTsMs.low >>> 0, message.startTsMs.high >>> 0).toNumber(true) : message.startTsMs;
                if (message.endTsMs != null && message.hasOwnProperty("endTsMs"))
                    if (typeof message.endTsMs === "number")
                        object.endTsMs = options.longs === String ? String(message.endTsMs) : message.endTsMs;
                    else
                        object.endTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.endTsMs) : options.longs === Number ? new $util.LongBits(message.endTsMs.low >>> 0, message.endTsMs.high >>> 0).toNumber(true) : message.endTsMs;
                if (message.s3Url != null && message.hasOwnProperty("s3Url"))
                    object.s3Url = message.s3Url;
                if (message.trackCount != null && message.hasOwnProperty("trackCount"))
                    if (typeof message.trackCount === "number")
                        object.trackCount = options.longs === String ? String(message.trackCount) : message.trackCount;
                    else
                        object.trackCount = options.longs === String ? $util.Long.prototype.toString.call(message.trackCount) : options.longs === Number ? new $util.LongBits(message.trackCount.low >>> 0, message.trackCount.high >>> 0).toNumber(true) : message.trackCount;
                if (message.compressedSizeBytes != null && message.hasOwnProperty("compressedSizeBytes"))
                    if (typeof message.compressedSizeBytes === "number")
                        object.compressedSizeBytes = options.longs === String ? String(message.compressedSizeBytes) : message.compressedSizeBytes;
                    else
                        object.compressedSizeBytes = options.longs === String ? $util.Long.prototype.toString.call(message.compressedSizeBytes) : options.longs === Number ? new $util.LongBits(message.compressedSizeBytes.low >>> 0, message.compressedSizeBytes.high >>> 0).toNumber(true) : message.compressedSizeBytes;
                return object;
            };

            /**
             * Converts this SnapshotMeta to JSON.
             * @function toJSON
             * @memberof harpy.v1.SnapshotMeta
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            SnapshotMeta.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for SnapshotMeta
             * @function getTypeUrl
             * @memberof harpy.v1.SnapshotMeta
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            SnapshotMeta.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.SnapshotMeta";
            };

            return SnapshotMeta;
        })();

        v1.LinkUpsert = (function() {

            /**
             * Properties of a LinkUpsert.
             * @memberof harpy.v1
             * @interface ILinkUpsert
             * @property {string|null} [id] LinkUpsert id
             * @property {harpy.v1.INodeRef|null} [from] LinkUpsert from
             * @property {string|null} [rel] LinkUpsert rel
             * @property {harpy.v1.INodeRef|null} [to] LinkUpsert to
             * @property {number|Long|null} [tsMs] LinkUpsert tsMs
             * @property {Object.<string,string>|null} [meta] LinkUpsert meta
             */

            /**
             * Constructs a new LinkUpsert.
             * @memberof harpy.v1
             * @classdesc Represents a LinkUpsert.
             * @implements ILinkUpsert
             * @constructor
             * @param {harpy.v1.ILinkUpsert=} [properties] Properties to set
             */
            function LinkUpsert(properties) {
                this.meta = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * LinkUpsert id.
             * @member {string} id
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.id = "";

            /**
             * LinkUpsert from.
             * @member {harpy.v1.INodeRef|null|undefined} from
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.from = null;

            /**
             * LinkUpsert rel.
             * @member {string} rel
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.rel = "";

            /**
             * LinkUpsert to.
             * @member {harpy.v1.INodeRef|null|undefined} to
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.to = null;

            /**
             * LinkUpsert tsMs.
             * @member {number|Long} tsMs
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.tsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * LinkUpsert meta.
             * @member {Object.<string,string>} meta
             * @memberof harpy.v1.LinkUpsert
             * @instance
             */
            LinkUpsert.prototype.meta = $util.emptyObject;

            /**
             * Creates a new LinkUpsert instance using the specified properties.
             * @function create
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {harpy.v1.ILinkUpsert=} [properties] Properties to set
             * @returns {harpy.v1.LinkUpsert} LinkUpsert instance
             */
            LinkUpsert.create = function create(properties) {
                return new LinkUpsert(properties);
            };

            /**
             * Encodes the specified LinkUpsert message. Does not implicitly {@link harpy.v1.LinkUpsert.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {harpy.v1.ILinkUpsert} message LinkUpsert message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            LinkUpsert.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.from != null && Object.hasOwnProperty.call(message, "from"))
                    $root.harpy.v1.NodeRef.encode(message.from, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                if (message.rel != null && Object.hasOwnProperty.call(message, "rel"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.rel);
                if (message.to != null && Object.hasOwnProperty.call(message, "to"))
                    $root.harpy.v1.NodeRef.encode(message.to, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                if (message.tsMs != null && Object.hasOwnProperty.call(message, "tsMs"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.tsMs);
                if (message.meta != null && Object.hasOwnProperty.call(message, "meta"))
                    for (let keys = Object.keys(message.meta), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 6, wireType 2 =*/50).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.meta[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified LinkUpsert message, length delimited. Does not implicitly {@link harpy.v1.LinkUpsert.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {harpy.v1.ILinkUpsert} message LinkUpsert message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            LinkUpsert.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a LinkUpsert message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.LinkUpsert} LinkUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            LinkUpsert.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.LinkUpsert(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.from = $root.harpy.v1.NodeRef.decode(reader, reader.uint32());
                            break;
                        }
                    case 3: {
                            message.rel = reader.string();
                            break;
                        }
                    case 4: {
                            message.to = $root.harpy.v1.NodeRef.decode(reader, reader.uint32());
                            break;
                        }
                    case 5: {
                            message.tsMs = reader.uint64();
                            break;
                        }
                    case 6: {
                            if (message.meta === $util.emptyObject)
                                message.meta = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.string();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.meta[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a LinkUpsert message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.LinkUpsert} LinkUpsert
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            LinkUpsert.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a LinkUpsert message.
             * @function verify
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            LinkUpsert.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.from != null && message.hasOwnProperty("from")) {
                    let error = $root.harpy.v1.NodeRef.verify(message.from);
                    if (error)
                        return "from." + error;
                }
                if (message.rel != null && message.hasOwnProperty("rel"))
                    if (!$util.isString(message.rel))
                        return "rel: string expected";
                if (message.to != null && message.hasOwnProperty("to")) {
                    let error = $root.harpy.v1.NodeRef.verify(message.to);
                    if (error)
                        return "to." + error;
                }
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (!$util.isInteger(message.tsMs) && !(message.tsMs && $util.isInteger(message.tsMs.low) && $util.isInteger(message.tsMs.high)))
                        return "tsMs: integer|Long expected";
                if (message.meta != null && message.hasOwnProperty("meta")) {
                    if (!$util.isObject(message.meta))
                        return "meta: object expected";
                    let key = Object.keys(message.meta);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.meta[key[i]]))
                            return "meta: string{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a LinkUpsert message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.LinkUpsert} LinkUpsert
             */
            LinkUpsert.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.LinkUpsert)
                    return object;
                let message = new $root.harpy.v1.LinkUpsert();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.from != null) {
                    if (typeof object.from !== "object")
                        throw TypeError(".harpy.v1.LinkUpsert.from: object expected");
                    message.from = $root.harpy.v1.NodeRef.fromObject(object.from);
                }
                if (object.rel != null)
                    message.rel = String(object.rel);
                if (object.to != null) {
                    if (typeof object.to !== "object")
                        throw TypeError(".harpy.v1.LinkUpsert.to: object expected");
                    message.to = $root.harpy.v1.NodeRef.fromObject(object.to);
                }
                if (object.tsMs != null)
                    if ($util.Long)
                        (message.tsMs = $util.Long.fromValue(object.tsMs)).unsigned = true;
                    else if (typeof object.tsMs === "string")
                        message.tsMs = parseInt(object.tsMs, 10);
                    else if (typeof object.tsMs === "number")
                        message.tsMs = object.tsMs;
                    else if (typeof object.tsMs === "object")
                        message.tsMs = new $util.LongBits(object.tsMs.low >>> 0, object.tsMs.high >>> 0).toNumber(true);
                if (object.meta) {
                    if (typeof object.meta !== "object")
                        throw TypeError(".harpy.v1.LinkUpsert.meta: object expected");
                    message.meta = {};
                    for (let keys = Object.keys(object.meta), i = 0; i < keys.length; ++i)
                        message.meta[keys[i]] = String(object.meta[keys[i]]);
                }
                return message;
            };

            /**
             * Creates a plain object from a LinkUpsert message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {harpy.v1.LinkUpsert} message LinkUpsert
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            LinkUpsert.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.objects || options.defaults)
                    object.meta = {};
                if (options.defaults) {
                    object.id = "";
                    object.from = null;
                    object.rel = "";
                    object.to = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.tsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.tsMs = options.longs === String ? "0" : 0;
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.from != null && message.hasOwnProperty("from"))
                    object.from = $root.harpy.v1.NodeRef.toObject(message.from, options);
                if (message.rel != null && message.hasOwnProperty("rel"))
                    object.rel = message.rel;
                if (message.to != null && message.hasOwnProperty("to"))
                    object.to = $root.harpy.v1.NodeRef.toObject(message.to, options);
                if (message.tsMs != null && message.hasOwnProperty("tsMs"))
                    if (typeof message.tsMs === "number")
                        object.tsMs = options.longs === String ? String(message.tsMs) : message.tsMs;
                    else
                        object.tsMs = options.longs === String ? $util.Long.prototype.toString.call(message.tsMs) : options.longs === Number ? new $util.LongBits(message.tsMs.low >>> 0, message.tsMs.high >>> 0).toNumber(true) : message.tsMs;
                let keys2;
                if (message.meta && (keys2 = Object.keys(message.meta)).length) {
                    object.meta = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.meta[keys2[j]] = message.meta[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this LinkUpsert to JSON.
             * @function toJSON
             * @memberof harpy.v1.LinkUpsert
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            LinkUpsert.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for LinkUpsert
             * @function getTypeUrl
             * @memberof harpy.v1.LinkUpsert
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            LinkUpsert.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.LinkUpsert";
            };

            return LinkUpsert;
        })();

        v1.NodeRef = (function() {

            /**
             * Properties of a NodeRef.
             * @memberof harpy.v1
             * @interface INodeRef
             * @property {harpy.v1.NodeType|null} [nodeType] NodeRef nodeType
             * @property {string|null} [nodeId] NodeRef nodeId
             */

            /**
             * Constructs a new NodeRef.
             * @memberof harpy.v1
             * @classdesc Represents a NodeRef.
             * @implements INodeRef
             * @constructor
             * @param {harpy.v1.INodeRef=} [properties] Properties to set
             */
            function NodeRef(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * NodeRef nodeType.
             * @member {harpy.v1.NodeType} nodeType
             * @memberof harpy.v1.NodeRef
             * @instance
             */
            NodeRef.prototype.nodeType = 0;

            /**
             * NodeRef nodeId.
             * @member {string} nodeId
             * @memberof harpy.v1.NodeRef
             * @instance
             */
            NodeRef.prototype.nodeId = "";

            /**
             * Creates a new NodeRef instance using the specified properties.
             * @function create
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {harpy.v1.INodeRef=} [properties] Properties to set
             * @returns {harpy.v1.NodeRef} NodeRef instance
             */
            NodeRef.create = function create(properties) {
                return new NodeRef(properties);
            };

            /**
             * Encodes the specified NodeRef message. Does not implicitly {@link harpy.v1.NodeRef.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {harpy.v1.INodeRef} message NodeRef message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            NodeRef.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.nodeType != null && Object.hasOwnProperty.call(message, "nodeType"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.nodeType);
                if (message.nodeId != null && Object.hasOwnProperty.call(message, "nodeId"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.nodeId);
                return writer;
            };

            /**
             * Encodes the specified NodeRef message, length delimited. Does not implicitly {@link harpy.v1.NodeRef.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {harpy.v1.INodeRef} message NodeRef message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            NodeRef.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a NodeRef message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.NodeRef} NodeRef
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            NodeRef.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.NodeRef();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.nodeType = reader.int32();
                            break;
                        }
                    case 2: {
                            message.nodeId = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a NodeRef message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.NodeRef} NodeRef
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            NodeRef.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a NodeRef message.
             * @function verify
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            NodeRef.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.nodeType != null && message.hasOwnProperty("nodeType"))
                    switch (message.nodeType) {
                    default:
                        return "nodeType: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        break;
                    }
                if (message.nodeId != null && message.hasOwnProperty("nodeId"))
                    if (!$util.isString(message.nodeId))
                        return "nodeId: string expected";
                return null;
            };

            /**
             * Creates a NodeRef message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.NodeRef} NodeRef
             */
            NodeRef.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.NodeRef)
                    return object;
                let message = new $root.harpy.v1.NodeRef();
                switch (object.nodeType) {
                default:
                    if (typeof object.nodeType === "number") {
                        message.nodeType = object.nodeType;
                        break;
                    }
                    break;
                case "NODE_TYPE_UNSPECIFIED":
                case 0:
                    message.nodeType = 0;
                    break;
                case "NODE_TYPE_TRACK":
                case 1:
                    message.nodeType = 1;
                    break;
                case "NODE_TYPE_SENSOR":
                case 2:
                    message.nodeType = 2;
                    break;
                case "NODE_TYPE_DETECTION":
                case 3:
                    message.nodeType = 3;
                    break;
                case "NODE_TYPE_ALERT":
                case 4:
                    message.nodeType = 4;
                    break;
                }
                if (object.nodeId != null)
                    message.nodeId = String(object.nodeId);
                return message;
            };

            /**
             * Creates a plain object from a NodeRef message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {harpy.v1.NodeRef} message NodeRef
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            NodeRef.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.nodeType = options.enums === String ? "NODE_TYPE_UNSPECIFIED" : 0;
                    object.nodeId = "";
                }
                if (message.nodeType != null && message.hasOwnProperty("nodeType"))
                    object.nodeType = options.enums === String ? $root.harpy.v1.NodeType[message.nodeType] === undefined ? message.nodeType : $root.harpy.v1.NodeType[message.nodeType] : message.nodeType;
                if (message.nodeId != null && message.hasOwnProperty("nodeId"))
                    object.nodeId = message.nodeId;
                return object;
            };

            /**
             * Converts this NodeRef to JSON.
             * @function toJSON
             * @memberof harpy.v1.NodeRef
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            NodeRef.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for NodeRef
             * @function getTypeUrl
             * @memberof harpy.v1.NodeRef
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            NodeRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.NodeRef";
            };

            return NodeRef;
        })();

        /**
         * NodeType enum.
         * @name harpy.v1.NodeType
         * @enum {number}
         * @property {number} NODE_TYPE_UNSPECIFIED=0 NODE_TYPE_UNSPECIFIED value
         * @property {number} NODE_TYPE_TRACK=1 NODE_TYPE_TRACK value
         * @property {number} NODE_TYPE_SENSOR=2 NODE_TYPE_SENSOR value
         * @property {number} NODE_TYPE_DETECTION=3 NODE_TYPE_DETECTION value
         * @property {number} NODE_TYPE_ALERT=4 NODE_TYPE_ALERT value
         */
        v1.NodeType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "NODE_TYPE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "NODE_TYPE_TRACK"] = 1;
            values[valuesById[2] = "NODE_TYPE_SENSOR"] = 2;
            values[valuesById[3] = "NODE_TYPE_DETECTION"] = 3;
            values[valuesById[4] = "NODE_TYPE_ALERT"] = 4;
            return values;
        })();

        v1.SubscriptionRequest = (function() {

            /**
             * Properties of a SubscriptionRequest.
             * @memberof harpy.v1
             * @interface ISubscriptionRequest
             * @property {harpy.v1.IBoundingBox|null} [viewport] SubscriptionRequest viewport
             * @property {Array.<harpy.v1.LayerType>|null} [layers] SubscriptionRequest layers
             * @property {harpy.v1.ITimeRange|null} [timeRange] SubscriptionRequest timeRange
             * @property {harpy.v1.SubscriptionMode|null} [mode] SubscriptionRequest mode
             */

            /**
             * Constructs a new SubscriptionRequest.
             * @memberof harpy.v1
             * @classdesc Represents a SubscriptionRequest.
             * @implements ISubscriptionRequest
             * @constructor
             * @param {harpy.v1.ISubscriptionRequest=} [properties] Properties to set
             */
            function SubscriptionRequest(properties) {
                this.layers = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * SubscriptionRequest viewport.
             * @member {harpy.v1.IBoundingBox|null|undefined} viewport
             * @memberof harpy.v1.SubscriptionRequest
             * @instance
             */
            SubscriptionRequest.prototype.viewport = null;

            /**
             * SubscriptionRequest layers.
             * @member {Array.<harpy.v1.LayerType>} layers
             * @memberof harpy.v1.SubscriptionRequest
             * @instance
             */
            SubscriptionRequest.prototype.layers = $util.emptyArray;

            /**
             * SubscriptionRequest timeRange.
             * @member {harpy.v1.ITimeRange|null|undefined} timeRange
             * @memberof harpy.v1.SubscriptionRequest
             * @instance
             */
            SubscriptionRequest.prototype.timeRange = null;

            /**
             * SubscriptionRequest mode.
             * @member {harpy.v1.SubscriptionMode} mode
             * @memberof harpy.v1.SubscriptionRequest
             * @instance
             */
            SubscriptionRequest.prototype.mode = 0;

            /**
             * Creates a new SubscriptionRequest instance using the specified properties.
             * @function create
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {harpy.v1.ISubscriptionRequest=} [properties] Properties to set
             * @returns {harpy.v1.SubscriptionRequest} SubscriptionRequest instance
             */
            SubscriptionRequest.create = function create(properties) {
                return new SubscriptionRequest(properties);
            };

            /**
             * Encodes the specified SubscriptionRequest message. Does not implicitly {@link harpy.v1.SubscriptionRequest.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {harpy.v1.ISubscriptionRequest} message SubscriptionRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SubscriptionRequest.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.viewport != null && Object.hasOwnProperty.call(message, "viewport"))
                    $root.harpy.v1.BoundingBox.encode(message.viewport, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                if (message.layers != null && message.layers.length) {
                    writer.uint32(/* id 2, wireType 2 =*/18).fork();
                    for (let i = 0; i < message.layers.length; ++i)
                        writer.int32(message.layers[i]);
                    writer.ldelim();
                }
                if (message.timeRange != null && Object.hasOwnProperty.call(message, "timeRange"))
                    $root.harpy.v1.TimeRange.encode(message.timeRange, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                if (message.mode != null && Object.hasOwnProperty.call(message, "mode"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.mode);
                return writer;
            };

            /**
             * Encodes the specified SubscriptionRequest message, length delimited. Does not implicitly {@link harpy.v1.SubscriptionRequest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {harpy.v1.ISubscriptionRequest} message SubscriptionRequest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SubscriptionRequest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a SubscriptionRequest message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.SubscriptionRequest} SubscriptionRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SubscriptionRequest.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.SubscriptionRequest();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.viewport = $root.harpy.v1.BoundingBox.decode(reader, reader.uint32());
                            break;
                        }
                    case 2: {
                            if (!(message.layers && message.layers.length))
                                message.layers = [];
                            if ((tag & 7) === 2) {
                                let end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.layers.push(reader.int32());
                            } else
                                message.layers.push(reader.int32());
                            break;
                        }
                    case 3: {
                            message.timeRange = $root.harpy.v1.TimeRange.decode(reader, reader.uint32());
                            break;
                        }
                    case 4: {
                            message.mode = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a SubscriptionRequest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.SubscriptionRequest} SubscriptionRequest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SubscriptionRequest.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a SubscriptionRequest message.
             * @function verify
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            SubscriptionRequest.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.viewport != null && message.hasOwnProperty("viewport")) {
                    let error = $root.harpy.v1.BoundingBox.verify(message.viewport);
                    if (error)
                        return "viewport." + error;
                }
                if (message.layers != null && message.hasOwnProperty("layers")) {
                    if (!Array.isArray(message.layers))
                        return "layers: array expected";
                    for (let i = 0; i < message.layers.length; ++i)
                        switch (message.layers[i]) {
                        default:
                            return "layers: enum value[] expected";
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                        case 6:
                        case 7:
                            break;
                        }
                }
                if (message.timeRange != null && message.hasOwnProperty("timeRange")) {
                    let error = $root.harpy.v1.TimeRange.verify(message.timeRange);
                    if (error)
                        return "timeRange." + error;
                }
                if (message.mode != null && message.hasOwnProperty("mode"))
                    switch (message.mode) {
                    default:
                        return "mode: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                        break;
                    }
                return null;
            };

            /**
             * Creates a SubscriptionRequest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.SubscriptionRequest} SubscriptionRequest
             */
            SubscriptionRequest.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.SubscriptionRequest)
                    return object;
                let message = new $root.harpy.v1.SubscriptionRequest();
                if (object.viewport != null) {
                    if (typeof object.viewport !== "object")
                        throw TypeError(".harpy.v1.SubscriptionRequest.viewport: object expected");
                    message.viewport = $root.harpy.v1.BoundingBox.fromObject(object.viewport);
                }
                if (object.layers) {
                    if (!Array.isArray(object.layers))
                        throw TypeError(".harpy.v1.SubscriptionRequest.layers: array expected");
                    message.layers = [];
                    for (let i = 0; i < object.layers.length; ++i)
                        switch (object.layers[i]) {
                        default:
                            if (typeof object.layers[i] === "number") {
                                message.layers[i] = object.layers[i];
                                break;
                            }
                        case "LAYER_TYPE_UNSPECIFIED":
                        case 0:
                            message.layers[i] = 0;
                            break;
                        case "LAYER_TYPE_AIRCRAFT":
                        case 1:
                            message.layers[i] = 1;
                            break;
                        case "LAYER_TYPE_SATELLITE":
                        case 2:
                            message.layers[i] = 2;
                            break;
                        case "LAYER_TYPE_GROUND":
                        case 3:
                            message.layers[i] = 3;
                            break;
                        case "LAYER_TYPE_VESSEL":
                        case 4:
                            message.layers[i] = 4;
                            break;
                        case "LAYER_TYPE_CAMERA":
                        case 5:
                            message.layers[i] = 5;
                            break;
                        case "LAYER_TYPE_DETECTION":
                        case 6:
                            message.layers[i] = 6;
                            break;
                        case "LAYER_TYPE_ALERT":
                        case 7:
                            message.layers[i] = 7;
                            break;
                        }
                }
                if (object.timeRange != null) {
                    if (typeof object.timeRange !== "object")
                        throw TypeError(".harpy.v1.SubscriptionRequest.timeRange: object expected");
                    message.timeRange = $root.harpy.v1.TimeRange.fromObject(object.timeRange);
                }
                switch (object.mode) {
                default:
                    if (typeof object.mode === "number") {
                        message.mode = object.mode;
                        break;
                    }
                    break;
                case "SUBSCRIPTION_MODE_UNSPECIFIED":
                case 0:
                    message.mode = 0;
                    break;
                case "SUBSCRIPTION_MODE_LIVE":
                case 1:
                    message.mode = 1;
                    break;
                case "SUBSCRIPTION_MODE_PLAYBACK":
                case 2:
                    message.mode = 2;
                    break;
                }
                return message;
            };

            /**
             * Creates a plain object from a SubscriptionRequest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {harpy.v1.SubscriptionRequest} message SubscriptionRequest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            SubscriptionRequest.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.layers = [];
                if (options.defaults) {
                    object.viewport = null;
                    object.timeRange = null;
                    object.mode = options.enums === String ? "SUBSCRIPTION_MODE_UNSPECIFIED" : 0;
                }
                if (message.viewport != null && message.hasOwnProperty("viewport"))
                    object.viewport = $root.harpy.v1.BoundingBox.toObject(message.viewport, options);
                if (message.layers && message.layers.length) {
                    object.layers = [];
                    for (let j = 0; j < message.layers.length; ++j)
                        object.layers[j] = options.enums === String ? $root.harpy.v1.LayerType[message.layers[j]] === undefined ? message.layers[j] : $root.harpy.v1.LayerType[message.layers[j]] : message.layers[j];
                }
                if (message.timeRange != null && message.hasOwnProperty("timeRange"))
                    object.timeRange = $root.harpy.v1.TimeRange.toObject(message.timeRange, options);
                if (message.mode != null && message.hasOwnProperty("mode"))
                    object.mode = options.enums === String ? $root.harpy.v1.SubscriptionMode[message.mode] === undefined ? message.mode : $root.harpy.v1.SubscriptionMode[message.mode] : message.mode;
                return object;
            };

            /**
             * Converts this SubscriptionRequest to JSON.
             * @function toJSON
             * @memberof harpy.v1.SubscriptionRequest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            SubscriptionRequest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for SubscriptionRequest
             * @function getTypeUrl
             * @memberof harpy.v1.SubscriptionRequest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            SubscriptionRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.SubscriptionRequest";
            };

            return SubscriptionRequest;
        })();

        v1.BoundingBox = (function() {

            /**
             * Properties of a BoundingBox.
             * @memberof harpy.v1
             * @interface IBoundingBox
             * @property {number|null} [minLat] BoundingBox minLat
             * @property {number|null} [minLon] BoundingBox minLon
             * @property {number|null} [maxLat] BoundingBox maxLat
             * @property {number|null} [maxLon] BoundingBox maxLon
             */

            /**
             * Constructs a new BoundingBox.
             * @memberof harpy.v1
             * @classdesc Represents a BoundingBox.
             * @implements IBoundingBox
             * @constructor
             * @param {harpy.v1.IBoundingBox=} [properties] Properties to set
             */
            function BoundingBox(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * BoundingBox minLat.
             * @member {number} minLat
             * @memberof harpy.v1.BoundingBox
             * @instance
             */
            BoundingBox.prototype.minLat = 0;

            /**
             * BoundingBox minLon.
             * @member {number} minLon
             * @memberof harpy.v1.BoundingBox
             * @instance
             */
            BoundingBox.prototype.minLon = 0;

            /**
             * BoundingBox maxLat.
             * @member {number} maxLat
             * @memberof harpy.v1.BoundingBox
             * @instance
             */
            BoundingBox.prototype.maxLat = 0;

            /**
             * BoundingBox maxLon.
             * @member {number} maxLon
             * @memberof harpy.v1.BoundingBox
             * @instance
             */
            BoundingBox.prototype.maxLon = 0;

            /**
             * Creates a new BoundingBox instance using the specified properties.
             * @function create
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {harpy.v1.IBoundingBox=} [properties] Properties to set
             * @returns {harpy.v1.BoundingBox} BoundingBox instance
             */
            BoundingBox.create = function create(properties) {
                return new BoundingBox(properties);
            };

            /**
             * Encodes the specified BoundingBox message. Does not implicitly {@link harpy.v1.BoundingBox.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {harpy.v1.IBoundingBox} message BoundingBox message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BoundingBox.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.minLat != null && Object.hasOwnProperty.call(message, "minLat"))
                    writer.uint32(/* id 1, wireType 1 =*/9).double(message.minLat);
                if (message.minLon != null && Object.hasOwnProperty.call(message, "minLon"))
                    writer.uint32(/* id 2, wireType 1 =*/17).double(message.minLon);
                if (message.maxLat != null && Object.hasOwnProperty.call(message, "maxLat"))
                    writer.uint32(/* id 3, wireType 1 =*/25).double(message.maxLat);
                if (message.maxLon != null && Object.hasOwnProperty.call(message, "maxLon"))
                    writer.uint32(/* id 4, wireType 1 =*/33).double(message.maxLon);
                return writer;
            };

            /**
             * Encodes the specified BoundingBox message, length delimited. Does not implicitly {@link harpy.v1.BoundingBox.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {harpy.v1.IBoundingBox} message BoundingBox message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BoundingBox.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a BoundingBox message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.BoundingBox} BoundingBox
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BoundingBox.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.BoundingBox();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.minLat = reader.double();
                            break;
                        }
                    case 2: {
                            message.minLon = reader.double();
                            break;
                        }
                    case 3: {
                            message.maxLat = reader.double();
                            break;
                        }
                    case 4: {
                            message.maxLon = reader.double();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a BoundingBox message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.BoundingBox} BoundingBox
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BoundingBox.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a BoundingBox message.
             * @function verify
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            BoundingBox.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.minLat != null && message.hasOwnProperty("minLat"))
                    if (typeof message.minLat !== "number")
                        return "minLat: number expected";
                if (message.minLon != null && message.hasOwnProperty("minLon"))
                    if (typeof message.minLon !== "number")
                        return "minLon: number expected";
                if (message.maxLat != null && message.hasOwnProperty("maxLat"))
                    if (typeof message.maxLat !== "number")
                        return "maxLat: number expected";
                if (message.maxLon != null && message.hasOwnProperty("maxLon"))
                    if (typeof message.maxLon !== "number")
                        return "maxLon: number expected";
                return null;
            };

            /**
             * Creates a BoundingBox message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.BoundingBox} BoundingBox
             */
            BoundingBox.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.BoundingBox)
                    return object;
                let message = new $root.harpy.v1.BoundingBox();
                if (object.minLat != null)
                    message.minLat = Number(object.minLat);
                if (object.minLon != null)
                    message.minLon = Number(object.minLon);
                if (object.maxLat != null)
                    message.maxLat = Number(object.maxLat);
                if (object.maxLon != null)
                    message.maxLon = Number(object.maxLon);
                return message;
            };

            /**
             * Creates a plain object from a BoundingBox message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {harpy.v1.BoundingBox} message BoundingBox
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            BoundingBox.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.minLat = 0;
                    object.minLon = 0;
                    object.maxLat = 0;
                    object.maxLon = 0;
                }
                if (message.minLat != null && message.hasOwnProperty("minLat"))
                    object.minLat = options.json && !isFinite(message.minLat) ? String(message.minLat) : message.minLat;
                if (message.minLon != null && message.hasOwnProperty("minLon"))
                    object.minLon = options.json && !isFinite(message.minLon) ? String(message.minLon) : message.minLon;
                if (message.maxLat != null && message.hasOwnProperty("maxLat"))
                    object.maxLat = options.json && !isFinite(message.maxLat) ? String(message.maxLat) : message.maxLat;
                if (message.maxLon != null && message.hasOwnProperty("maxLon"))
                    object.maxLon = options.json && !isFinite(message.maxLon) ? String(message.maxLon) : message.maxLon;
                return object;
            };

            /**
             * Converts this BoundingBox to JSON.
             * @function toJSON
             * @memberof harpy.v1.BoundingBox
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            BoundingBox.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for BoundingBox
             * @function getTypeUrl
             * @memberof harpy.v1.BoundingBox
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            BoundingBox.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.BoundingBox";
            };

            return BoundingBox;
        })();

        /**
         * LayerType enum.
         * @name harpy.v1.LayerType
         * @enum {number}
         * @property {number} LAYER_TYPE_UNSPECIFIED=0 LAYER_TYPE_UNSPECIFIED value
         * @property {number} LAYER_TYPE_AIRCRAFT=1 LAYER_TYPE_AIRCRAFT value
         * @property {number} LAYER_TYPE_SATELLITE=2 LAYER_TYPE_SATELLITE value
         * @property {number} LAYER_TYPE_GROUND=3 LAYER_TYPE_GROUND value
         * @property {number} LAYER_TYPE_VESSEL=4 LAYER_TYPE_VESSEL value
         * @property {number} LAYER_TYPE_CAMERA=5 LAYER_TYPE_CAMERA value
         * @property {number} LAYER_TYPE_DETECTION=6 LAYER_TYPE_DETECTION value
         * @property {number} LAYER_TYPE_ALERT=7 LAYER_TYPE_ALERT value
         */
        v1.LayerType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "LAYER_TYPE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "LAYER_TYPE_AIRCRAFT"] = 1;
            values[valuesById[2] = "LAYER_TYPE_SATELLITE"] = 2;
            values[valuesById[3] = "LAYER_TYPE_GROUND"] = 3;
            values[valuesById[4] = "LAYER_TYPE_VESSEL"] = 4;
            values[valuesById[5] = "LAYER_TYPE_CAMERA"] = 5;
            values[valuesById[6] = "LAYER_TYPE_DETECTION"] = 6;
            values[valuesById[7] = "LAYER_TYPE_ALERT"] = 7;
            return values;
        })();

        v1.TimeRange = (function() {

            /**
             * Properties of a TimeRange.
             * @memberof harpy.v1
             * @interface ITimeRange
             * @property {harpy.v1.ILiveMode|null} [live] TimeRange live
             * @property {harpy.v1.IPlaybackMode|null} [playback] TimeRange playback
             */

            /**
             * Constructs a new TimeRange.
             * @memberof harpy.v1
             * @classdesc Represents a TimeRange.
             * @implements ITimeRange
             * @constructor
             * @param {harpy.v1.ITimeRange=} [properties] Properties to set
             */
            function TimeRange(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * TimeRange live.
             * @member {harpy.v1.ILiveMode|null|undefined} live
             * @memberof harpy.v1.TimeRange
             * @instance
             */
            TimeRange.prototype.live = null;

            /**
             * TimeRange playback.
             * @member {harpy.v1.IPlaybackMode|null|undefined} playback
             * @memberof harpy.v1.TimeRange
             * @instance
             */
            TimeRange.prototype.playback = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * TimeRange range.
             * @member {"live"|"playback"|undefined} range
             * @memberof harpy.v1.TimeRange
             * @instance
             */
            Object.defineProperty(TimeRange.prototype, "range", {
                get: $util.oneOfGetter($oneOfFields = ["live", "playback"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new TimeRange instance using the specified properties.
             * @function create
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {harpy.v1.ITimeRange=} [properties] Properties to set
             * @returns {harpy.v1.TimeRange} TimeRange instance
             */
            TimeRange.create = function create(properties) {
                return new TimeRange(properties);
            };

            /**
             * Encodes the specified TimeRange message. Does not implicitly {@link harpy.v1.TimeRange.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {harpy.v1.ITimeRange} message TimeRange message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TimeRange.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.live != null && Object.hasOwnProperty.call(message, "live"))
                    $root.harpy.v1.LiveMode.encode(message.live, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                if (message.playback != null && Object.hasOwnProperty.call(message, "playback"))
                    $root.harpy.v1.PlaybackMode.encode(message.playback, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified TimeRange message, length delimited. Does not implicitly {@link harpy.v1.TimeRange.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {harpy.v1.ITimeRange} message TimeRange message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            TimeRange.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a TimeRange message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.TimeRange} TimeRange
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TimeRange.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.TimeRange();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.live = $root.harpy.v1.LiveMode.decode(reader, reader.uint32());
                            break;
                        }
                    case 2: {
                            message.playback = $root.harpy.v1.PlaybackMode.decode(reader, reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a TimeRange message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.TimeRange} TimeRange
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            TimeRange.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a TimeRange message.
             * @function verify
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            TimeRange.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.live != null && message.hasOwnProperty("live")) {
                    properties.range = 1;
                    {
                        let error = $root.harpy.v1.LiveMode.verify(message.live);
                        if (error)
                            return "live." + error;
                    }
                }
                if (message.playback != null && message.hasOwnProperty("playback")) {
                    if (properties.range === 1)
                        return "range: multiple values";
                    properties.range = 1;
                    {
                        let error = $root.harpy.v1.PlaybackMode.verify(message.playback);
                        if (error)
                            return "playback." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a TimeRange message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.TimeRange} TimeRange
             */
            TimeRange.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.TimeRange)
                    return object;
                let message = new $root.harpy.v1.TimeRange();
                if (object.live != null) {
                    if (typeof object.live !== "object")
                        throw TypeError(".harpy.v1.TimeRange.live: object expected");
                    message.live = $root.harpy.v1.LiveMode.fromObject(object.live);
                }
                if (object.playback != null) {
                    if (typeof object.playback !== "object")
                        throw TypeError(".harpy.v1.TimeRange.playback: object expected");
                    message.playback = $root.harpy.v1.PlaybackMode.fromObject(object.playback);
                }
                return message;
            };

            /**
             * Creates a plain object from a TimeRange message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {harpy.v1.TimeRange} message TimeRange
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            TimeRange.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (message.live != null && message.hasOwnProperty("live")) {
                    object.live = $root.harpy.v1.LiveMode.toObject(message.live, options);
                    if (options.oneofs)
                        object.range = "live";
                }
                if (message.playback != null && message.hasOwnProperty("playback")) {
                    object.playback = $root.harpy.v1.PlaybackMode.toObject(message.playback, options);
                    if (options.oneofs)
                        object.range = "playback";
                }
                return object;
            };

            /**
             * Converts this TimeRange to JSON.
             * @function toJSON
             * @memberof harpy.v1.TimeRange
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            TimeRange.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for TimeRange
             * @function getTypeUrl
             * @memberof harpy.v1.TimeRange
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            TimeRange.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.TimeRange";
            };

            return TimeRange;
        })();

        v1.LiveMode = (function() {

            /**
             * Properties of a LiveMode.
             * @memberof harpy.v1
             * @interface ILiveMode
             */

            /**
             * Constructs a new LiveMode.
             * @memberof harpy.v1
             * @classdesc Represents a LiveMode.
             * @implements ILiveMode
             * @constructor
             * @param {harpy.v1.ILiveMode=} [properties] Properties to set
             */
            function LiveMode(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Creates a new LiveMode instance using the specified properties.
             * @function create
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {harpy.v1.ILiveMode=} [properties] Properties to set
             * @returns {harpy.v1.LiveMode} LiveMode instance
             */
            LiveMode.create = function create(properties) {
                return new LiveMode(properties);
            };

            /**
             * Encodes the specified LiveMode message. Does not implicitly {@link harpy.v1.LiveMode.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {harpy.v1.ILiveMode} message LiveMode message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            LiveMode.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                return writer;
            };

            /**
             * Encodes the specified LiveMode message, length delimited. Does not implicitly {@link harpy.v1.LiveMode.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {harpy.v1.ILiveMode} message LiveMode message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            LiveMode.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a LiveMode message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.LiveMode} LiveMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            LiveMode.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.LiveMode();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a LiveMode message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.LiveMode} LiveMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            LiveMode.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a LiveMode message.
             * @function verify
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            LiveMode.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                return null;
            };

            /**
             * Creates a LiveMode message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.LiveMode} LiveMode
             */
            LiveMode.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.LiveMode)
                    return object;
                return new $root.harpy.v1.LiveMode();
            };

            /**
             * Creates a plain object from a LiveMode message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {harpy.v1.LiveMode} message LiveMode
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            LiveMode.toObject = function toObject() {
                return {};
            };

            /**
             * Converts this LiveMode to JSON.
             * @function toJSON
             * @memberof harpy.v1.LiveMode
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            LiveMode.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for LiveMode
             * @function getTypeUrl
             * @memberof harpy.v1.LiveMode
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            LiveMode.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.LiveMode";
            };

            return LiveMode;
        })();

        v1.PlaybackMode = (function() {

            /**
             * Properties of a PlaybackMode.
             * @memberof harpy.v1
             * @interface IPlaybackMode
             * @property {number|Long|null} [startTsMs] PlaybackMode startTsMs
             * @property {number|Long|null} [endTsMs] PlaybackMode endTsMs
             */

            /**
             * Constructs a new PlaybackMode.
             * @memberof harpy.v1
             * @classdesc Represents a PlaybackMode.
             * @implements IPlaybackMode
             * @constructor
             * @param {harpy.v1.IPlaybackMode=} [properties] Properties to set
             */
            function PlaybackMode(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * PlaybackMode startTsMs.
             * @member {number|Long} startTsMs
             * @memberof harpy.v1.PlaybackMode
             * @instance
             */
            PlaybackMode.prototype.startTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * PlaybackMode endTsMs.
             * @member {number|Long} endTsMs
             * @memberof harpy.v1.PlaybackMode
             * @instance
             */
            PlaybackMode.prototype.endTsMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * Creates a new PlaybackMode instance using the specified properties.
             * @function create
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {harpy.v1.IPlaybackMode=} [properties] Properties to set
             * @returns {harpy.v1.PlaybackMode} PlaybackMode instance
             */
            PlaybackMode.create = function create(properties) {
                return new PlaybackMode(properties);
            };

            /**
             * Encodes the specified PlaybackMode message. Does not implicitly {@link harpy.v1.PlaybackMode.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {harpy.v1.IPlaybackMode} message PlaybackMode message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PlaybackMode.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.startTsMs != null && Object.hasOwnProperty.call(message, "startTsMs"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.startTsMs);
                if (message.endTsMs != null && Object.hasOwnProperty.call(message, "endTsMs"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.endTsMs);
                return writer;
            };

            /**
             * Encodes the specified PlaybackMode message, length delimited. Does not implicitly {@link harpy.v1.PlaybackMode.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {harpy.v1.IPlaybackMode} message PlaybackMode message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PlaybackMode.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a PlaybackMode message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.PlaybackMode} PlaybackMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PlaybackMode.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.PlaybackMode();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.startTsMs = reader.uint64();
                            break;
                        }
                    case 2: {
                            message.endTsMs = reader.uint64();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a PlaybackMode message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.PlaybackMode} PlaybackMode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PlaybackMode.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a PlaybackMode message.
             * @function verify
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            PlaybackMode.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.startTsMs != null && message.hasOwnProperty("startTsMs"))
                    if (!$util.isInteger(message.startTsMs) && !(message.startTsMs && $util.isInteger(message.startTsMs.low) && $util.isInteger(message.startTsMs.high)))
                        return "startTsMs: integer|Long expected";
                if (message.endTsMs != null && message.hasOwnProperty("endTsMs"))
                    if (!$util.isInteger(message.endTsMs) && !(message.endTsMs && $util.isInteger(message.endTsMs.low) && $util.isInteger(message.endTsMs.high)))
                        return "endTsMs: integer|Long expected";
                return null;
            };

            /**
             * Creates a PlaybackMode message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.PlaybackMode} PlaybackMode
             */
            PlaybackMode.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.PlaybackMode)
                    return object;
                let message = new $root.harpy.v1.PlaybackMode();
                if (object.startTsMs != null)
                    if ($util.Long)
                        (message.startTsMs = $util.Long.fromValue(object.startTsMs)).unsigned = true;
                    else if (typeof object.startTsMs === "string")
                        message.startTsMs = parseInt(object.startTsMs, 10);
                    else if (typeof object.startTsMs === "number")
                        message.startTsMs = object.startTsMs;
                    else if (typeof object.startTsMs === "object")
                        message.startTsMs = new $util.LongBits(object.startTsMs.low >>> 0, object.startTsMs.high >>> 0).toNumber(true);
                if (object.endTsMs != null)
                    if ($util.Long)
                        (message.endTsMs = $util.Long.fromValue(object.endTsMs)).unsigned = true;
                    else if (typeof object.endTsMs === "string")
                        message.endTsMs = parseInt(object.endTsMs, 10);
                    else if (typeof object.endTsMs === "number")
                        message.endTsMs = object.endTsMs;
                    else if (typeof object.endTsMs === "object")
                        message.endTsMs = new $util.LongBits(object.endTsMs.low >>> 0, object.endTsMs.high >>> 0).toNumber(true);
                return message;
            };

            /**
             * Creates a plain object from a PlaybackMode message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {harpy.v1.PlaybackMode} message PlaybackMode
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            PlaybackMode.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.startTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.startTsMs = options.longs === String ? "0" : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.endTsMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                    } else
                        object.endTsMs = options.longs === String ? "0" : 0;
                }
                if (message.startTsMs != null && message.hasOwnProperty("startTsMs"))
                    if (typeof message.startTsMs === "number")
                        object.startTsMs = options.longs === String ? String(message.startTsMs) : message.startTsMs;
                    else
                        object.startTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.startTsMs) : options.longs === Number ? new $util.LongBits(message.startTsMs.low >>> 0, message.startTsMs.high >>> 0).toNumber(true) : message.startTsMs;
                if (message.endTsMs != null && message.hasOwnProperty("endTsMs"))
                    if (typeof message.endTsMs === "number")
                        object.endTsMs = options.longs === String ? String(message.endTsMs) : message.endTsMs;
                    else
                        object.endTsMs = options.longs === String ? $util.Long.prototype.toString.call(message.endTsMs) : options.longs === Number ? new $util.LongBits(message.endTsMs.low >>> 0, message.endTsMs.high >>> 0).toNumber(true) : message.endTsMs;
                return object;
            };

            /**
             * Converts this PlaybackMode to JSON.
             * @function toJSON
             * @memberof harpy.v1.PlaybackMode
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            PlaybackMode.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for PlaybackMode
             * @function getTypeUrl
             * @memberof harpy.v1.PlaybackMode
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            PlaybackMode.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.PlaybackMode";
            };

            return PlaybackMode;
        })();

        /**
         * SubscriptionMode enum.
         * @name harpy.v1.SubscriptionMode
         * @enum {number}
         * @property {number} SUBSCRIPTION_MODE_UNSPECIFIED=0 SUBSCRIPTION_MODE_UNSPECIFIED value
         * @property {number} SUBSCRIPTION_MODE_LIVE=1 SUBSCRIPTION_MODE_LIVE value
         * @property {number} SUBSCRIPTION_MODE_PLAYBACK=2 SUBSCRIPTION_MODE_PLAYBACK value
         */
        v1.SubscriptionMode = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "SUBSCRIPTION_MODE_UNSPECIFIED"] = 0;
            values[valuesById[1] = "SUBSCRIPTION_MODE_LIVE"] = 1;
            values[valuesById[2] = "SUBSCRIPTION_MODE_PLAYBACK"] = 2;
            return values;
        })();

        v1.SubscriptionAck = (function() {

            /**
             * Properties of a SubscriptionAck.
             * @memberof harpy.v1
             * @interface ISubscriptionAck
             * @property {string|null} [subscriptionId] SubscriptionAck subscriptionId
             * @property {boolean|null} [success] SubscriptionAck success
             * @property {string|null} [error] SubscriptionAck error
             */

            /**
             * Constructs a new SubscriptionAck.
             * @memberof harpy.v1
             * @classdesc Represents a SubscriptionAck.
             * @implements ISubscriptionAck
             * @constructor
             * @param {harpy.v1.ISubscriptionAck=} [properties] Properties to set
             */
            function SubscriptionAck(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * SubscriptionAck subscriptionId.
             * @member {string} subscriptionId
             * @memberof harpy.v1.SubscriptionAck
             * @instance
             */
            SubscriptionAck.prototype.subscriptionId = "";

            /**
             * SubscriptionAck success.
             * @member {boolean} success
             * @memberof harpy.v1.SubscriptionAck
             * @instance
             */
            SubscriptionAck.prototype.success = false;

            /**
             * SubscriptionAck error.
             * @member {string|null|undefined} error
             * @memberof harpy.v1.SubscriptionAck
             * @instance
             */
            SubscriptionAck.prototype.error = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(SubscriptionAck.prototype, "_error", {
                get: $util.oneOfGetter($oneOfFields = ["error"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new SubscriptionAck instance using the specified properties.
             * @function create
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {harpy.v1.ISubscriptionAck=} [properties] Properties to set
             * @returns {harpy.v1.SubscriptionAck} SubscriptionAck instance
             */
            SubscriptionAck.create = function create(properties) {
                return new SubscriptionAck(properties);
            };

            /**
             * Encodes the specified SubscriptionAck message. Does not implicitly {@link harpy.v1.SubscriptionAck.verify|verify} messages.
             * @function encode
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {harpy.v1.ISubscriptionAck} message SubscriptionAck message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SubscriptionAck.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.subscriptionId != null && Object.hasOwnProperty.call(message, "subscriptionId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.subscriptionId);
                if (message.success != null && Object.hasOwnProperty.call(message, "success"))
                    writer.uint32(/* id 2, wireType 0 =*/16).bool(message.success);
                if (message.error != null && Object.hasOwnProperty.call(message, "error"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.error);
                return writer;
            };

            /**
             * Encodes the specified SubscriptionAck message, length delimited. Does not implicitly {@link harpy.v1.SubscriptionAck.verify|verify} messages.
             * @function encodeDelimited
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {harpy.v1.ISubscriptionAck} message SubscriptionAck message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SubscriptionAck.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a SubscriptionAck message from the specified reader or buffer.
             * @function decode
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {harpy.v1.SubscriptionAck} SubscriptionAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SubscriptionAck.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.harpy.v1.SubscriptionAck();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.subscriptionId = reader.string();
                            break;
                        }
                    case 2: {
                            message.success = reader.bool();
                            break;
                        }
                    case 3: {
                            message.error = reader.string();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a SubscriptionAck message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {harpy.v1.SubscriptionAck} SubscriptionAck
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SubscriptionAck.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a SubscriptionAck message.
             * @function verify
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            SubscriptionAck.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.subscriptionId != null && message.hasOwnProperty("subscriptionId"))
                    if (!$util.isString(message.subscriptionId))
                        return "subscriptionId: string expected";
                if (message.success != null && message.hasOwnProperty("success"))
                    if (typeof message.success !== "boolean")
                        return "success: boolean expected";
                if (message.error != null && message.hasOwnProperty("error")) {
                    properties._error = 1;
                    if (!$util.isString(message.error))
                        return "error: string expected";
                }
                return null;
            };

            /**
             * Creates a SubscriptionAck message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {harpy.v1.SubscriptionAck} SubscriptionAck
             */
            SubscriptionAck.fromObject = function fromObject(object) {
                if (object instanceof $root.harpy.v1.SubscriptionAck)
                    return object;
                let message = new $root.harpy.v1.SubscriptionAck();
                if (object.subscriptionId != null)
                    message.subscriptionId = String(object.subscriptionId);
                if (object.success != null)
                    message.success = Boolean(object.success);
                if (object.error != null)
                    message.error = String(object.error);
                return message;
            };

            /**
             * Creates a plain object from a SubscriptionAck message. Also converts values to other types if specified.
             * @function toObject
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {harpy.v1.SubscriptionAck} message SubscriptionAck
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            SubscriptionAck.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.subscriptionId = "";
                    object.success = false;
                }
                if (message.subscriptionId != null && message.hasOwnProperty("subscriptionId"))
                    object.subscriptionId = message.subscriptionId;
                if (message.success != null && message.hasOwnProperty("success"))
                    object.success = message.success;
                if (message.error != null && message.hasOwnProperty("error")) {
                    object.error = message.error;
                    if (options.oneofs)
                        object._error = "error";
                }
                return object;
            };

            /**
             * Converts this SubscriptionAck to JSON.
             * @function toJSON
             * @memberof harpy.v1.SubscriptionAck
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            SubscriptionAck.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for SubscriptionAck
             * @function getTypeUrl
             * @memberof harpy.v1.SubscriptionAck
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            SubscriptionAck.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/harpy.v1.SubscriptionAck";
            };

            return SubscriptionAck;
        })();

        return v1;
    })();

    return harpy;
})();

export { $root as default };
