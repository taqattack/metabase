import type {
  NumericXAxisModel,
  TimeSeriesXAxisModel,
  XAxisModel,
} from "./types";

export const isTimeSeriesAxis = (
  axisModel: XAxisModel,
): axisModel is TimeSeriesXAxisModel => {
  return axisModel.axisType === "time";
};

export const isNumericAxis = (
  axisModel: XAxisModel,
): axisModel is NumericXAxisModel => {
  return axisModel.axisType === "value" || axisModel.axisType === "log";
};
