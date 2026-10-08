export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export type ValidationDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

export class ValidationError extends AppError {
  details: ValidationDetails;

  constructor(message: string, details: ValidationDetails) {
    super(message, 400);
    this.name = "ValidationError";
    this.details = details;
  }
}
