// SQLite adapter for the Windows host. App data stays in LocalAppData/Storyloom.
#pragma once
#include "NativeModules.h"
#include <winsqlite/winsqlite3.h>
#include <ShlObj.h>
#include <filesystem>
#include <memory>
#include <mutex>
#include <stdexcept>

namespace winrt::Microsoft::ReactNative {
REACT_MODULE(PromliveSqlite);
struct PromliveSqlite {
  sqlite3 *database{nullptr};
  std::mutex mutex;
  ~PromliveSqlite() { if (database) sqlite3_close(database); }
  void EnsureOpen() {
    if (database) return;
    PWSTR localPath = nullptr;
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &localPath))) throw std::runtime_error("Cannot open local application storage");
    std::filesystem::path directory(localPath);
    CoTaskMemFree(localPath);
    directory /= L"Storyloom";
    std::filesystem::create_directories(directory);
    const auto file = (directory / L"storyloom.sqlite").wstring();
    const int result = sqlite3_open16(file.c_str(), &database);
    if (result != SQLITE_OK) { if (database) sqlite3_close(database); database = nullptr; throw std::runtime_error("Cannot open SQLite database"); }
    sqlite3_busy_timeout(database, 5000);
  }
  REACT_METHOD(Execute, L"execute");
  void Execute(std::string sql, JSValueArray parameters, ReactPromise<JSValueObject> promise) noexcept {
    try {
      std::scoped_lock guard(mutex); EnsureOpen();
      sqlite3_stmt *raw = nullptr;
      if (sqlite3_prepare_v2(database, sql.c_str(), -1, &raw, nullptr) != SQLITE_OK) throw std::runtime_error("SQLite prepare failed");
      std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)> statement(raw, sqlite3_finalize);
      for (size_t index = 0; index < parameters.size(); ++index) {
        const auto &value = parameters[index]; const int position = static_cast<int>(index + 1); int code;
        switch (value.Type()) {
          case JSValueType::Null: code = sqlite3_bind_null(raw, position); break;
          case JSValueType::String: { const auto text = value.AsString(); code = sqlite3_bind_text(raw, position, text.data(), static_cast<int>(text.size()), SQLITE_TRANSIENT); break; }
          case JSValueType::Int64: code = sqlite3_bind_int64(raw, position, value.AsInt64()); break;
          case JSValueType::Double: code = sqlite3_bind_double(raw, position, value.AsDouble()); break;
          default: throw std::runtime_error("Unsupported SQLite parameter");
        }
        if (code != SQLITE_OK) throw std::runtime_error("SQLite binding failed");
      }
      JSValueArray rows; int status;
      while ((status = sqlite3_step(raw)) == SQLITE_ROW) {
        JSValueObject row;
        for (int column = 0; column < sqlite3_column_count(raw); ++column) {
          const auto key = sqlite3_column_name(raw, column);
          switch (sqlite3_column_type(raw, column)) {
            case SQLITE_NULL: row[key] = nullptr; break;
            case SQLITE_INTEGER: row[key] = static_cast<int64_t>(sqlite3_column_int64(raw, column)); break;
            case SQLITE_FLOAT: row[key] = sqlite3_column_double(raw, column); break;
            case SQLITE_TEXT: row[key] = std::string(reinterpret_cast<const char *>(sqlite3_column_text(raw, column)), sqlite3_column_bytes(raw, column)); break;
            default: throw std::runtime_error("Unsupported stored value");
          }
        }
        rows.emplace_back(std::move(row));
      }
      if (status != SQLITE_DONE) throw std::runtime_error("SQLite execution failed");
      JSValueObject result;
      result["rows"] = std::move(rows);
      result["changes"] = sqlite3_changes(database);
      promise.Resolve(result);
    } catch (const std::exception &error) { promise.Reject(error.what()); }
  }
  REACT_METHOD(Close, L"close");
  void Close(ReactPromise<void> promise) noexcept {
    std::scoped_lock guard(mutex);
    if (database) { sqlite3_close(database); database = nullptr; }
    promise.Resolve();
  }
};
}
