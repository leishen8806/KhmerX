/// Values the server validates, exactly as it expects them (Chinese strings).
/// Written as unicode escapes on purpose: they are wire identifiers, never
/// display text (the screen shows localized labels from the arb files).
library;

const String kWireMale = '\u7537'; // Male
const String kWireFemale = '\u5973'; // Female
const String kWireMarried = '\u5df2\u5a5a'; // Married
const String kWireSingle = '\u672a\u5a5a'; // Single
const String kWireParent = '\u7236\u6bcd'; // Parent
const String kWireSpouse = '\u914d\u5076'; // Spouse
const String kWireRelative = '\u4eb2\u5c5e'; // Relative
const String kWireFriend = '\u670b\u53cb'; // Friend
const String kWireVillageChief = '\u6751\u957f'; // VillageChief
const String kWireCompanySupervisor = '\u516c\u53f8\u4e3b\u7ba1'; // CompanySupervisor
const String kWireMotorbike = '\u6469\u6258\u8f66'; // Motorbike
const String kWireTukTuk = '\u561f\u561f\u8f66'; // TukTuk
const String kWireCar = '\u6c7d\u8f66'; // Car
const String kWireNone = '\u65e0'; // None
const String kWireRented = '\u79df\u623f'; // Rented
const String kWireOwnedProperty = '\u4e2a\u4eba\u623f\u4ea7'; // OwnedProperty

const List<String> kKycGenderValues = [kWireMale, kWireFemale];
const List<String> kKycMaritalValues = [kWireMarried, kWireSingle];
const List<String> kKycRelationValues = [kWireParent, kWireSpouse, kWireRelative, kWireFriend, kWireVillageChief, kWireCompanySupervisor];
const List<String> kKycVehicleValues = [kWireMotorbike, kWireTukTuk, kWireCar, kWireNone];
const List<String> kKycHousingValues = [kWireRented, kWireOwnedProperty, kWireNone];
const List<String> kKycBankValues = ['ABA Bank', 'ACLEDA Bank', 'Wing'];

/// Vehicle values that mean the customer owns a vehicle.
const List<String> kKycOwnedVehicleValues = [kWireMotorbike, kWireTukTuk, kWireCar];
