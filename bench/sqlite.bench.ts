import { databases } from "../test/db";
import { sharedBenchmarks } from "./shared";

const db = databases.find(([kind]) => kind === "sqlite");

if (!db) throw new Error("Unable to find database");

sharedBenchmarks(db[1]);
