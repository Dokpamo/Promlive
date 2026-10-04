#pragma once
#include "NativeModules.h"
#include <ShlObj.h>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <optional>
#include <stdexcept>

namespace winrt::Microsoft::ReactNative {
REACT_MODULE(PromliveScreenMemory);
struct PromliveScreenMemory {
  // Serialize comparison/replacement across RN instances and app processes.
  struct FileLock {
    HANDLE handle = CreateMutexW(nullptr, FALSE, L"Local\\PromliveScreenMemory");
    FileLock() {
      if (!handle) throw std::runtime_error("Cannot lock screen memory");
      const auto result = WaitForSingleObject(handle, INFINITE);
      if (result != WAIT_OBJECT_0 && result != WAIT_ABANDONED) {
        CloseHandle(handle); handle = nullptr; throw std::runtime_error("Cannot lock screen memory");
      }
    }
    ~FileLock() {if (handle) {ReleaseMutex(handle); CloseHandle(handle);}}
  };
  static std::filesystem::path File(const wchar_t *name) {
    PWSTR localPath = nullptr;
    if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &localPath))) throw std::runtime_error("Cannot locate screen memory");
    std::filesystem::path directory(localPath);
    CoTaskMemFree(localPath);
#ifdef PROMLIVE_PERFORMANCE_BUILD
    directory /= L"PromliveBenchmark";
#else
    directory /= L"Promlive";
#endif
    std::filesystem::create_directories(directory);
    return directory / name;
  }
  static std::optional<std::string> Load(const wchar_t *name) {
    const auto path = File(name);
    if (!std::filesystem::exists(path)) return std::nullopt;
    std::ifstream stream(path, std::ios::binary);
    if (!stream) throw std::runtime_error("Cannot read screen memory");
    std::string value{std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>()};
    if (stream.bad()) throw std::runtime_error("Cannot read screen memory");
    return value;
  }
  static JSValueObject ReadFile(const wchar_t *name) {
    const auto value = Load(name);
    if (!value) return {};
    return {{"value", *value}};
  }
  static void Replace(const wchar_t *name, const std::string &value, bool rotateBackup = false) {
    const auto path = File(name), temporary = File(L"screen-memory.tmp");
    {
      std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
      stream.write(value.data(), static_cast<std::streamsize>(value.size()));
      stream.flush();
      if (!stream) throw std::runtime_error("Cannot save screen memory");
    }
    // Only a known-good primary may replace the recovery copy. Until replacement
    // succeeds either that primary or the existing backup remains available.
    if (rotateBackup && !CopyFileW(path.c_str(), File(L"screen-memory.backup.json").c_str(), FALSE)) throw std::runtime_error("Cannot back up screen memory");
    if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) throw std::runtime_error("Cannot replace screen memory");
  }
  REACT_SYNC_METHOD(ReadSync, L"readSync");
  JSValueObject ReadSync(bool backup) noexcept {
    try {FileLock guard; return ReadFile(backup ? L"screen-memory.backup.json" : L"screen-memory.json");}
    catch (...) {return {{"error", "Cannot read screen memory"}};}
  }
  REACT_SYNC_METHOD(ReadViewSync, L"readViewSync");
  JSValueObject ReadViewSync() noexcept {
    try {FileLock guard; return ReadFile(L"screen-view.json");}
    catch (...) {return {{"error", "Cannot read screen view"}};}
  }
  REACT_METHOD(Read, L"read");
  void Read(ReactPromise<JSValueObject> promise) noexcept {
    try {FileLock guard; promise.Resolve(ReadFile(L"screen-memory.json"));}
    catch (...) {promise.Reject("Cannot read screen memory");}
  }
  REACT_METHOD(Write, L"write");
  void Write(std::string value, std::string expected, bool absent, bool backup, ReactPromise<bool> promise) noexcept {
    try {
      FileLock guard;
      const auto current = Load(L"screen-memory.json");
      if (absent ? current.has_value() : !current || *current != expected) {promise.Resolve(false); return;}
      Replace(L"screen-memory.json", value, backup && current.has_value());
      promise.Resolve(true);
    } catch (...) {promise.Reject("Cannot save screen memory");}
  }
  REACT_METHOD(WriteView, L"writeView");
  void WriteView(std::string value, ReactPromise<void> promise) noexcept {
    try {FileLock guard; Replace(L"screen-view.json", value); promise.Resolve();}
    catch (...) {promise.Reject("Cannot save screen view");}
  }
  REACT_SYNC_METHOD(ReadCacheSync, L"readCacheSync");
  JSValueObject ReadCacheSync() noexcept {
    try {FileLock guard; return ReadFile(L"workspace-cache-v2.json");}
    catch (...) {return {{"error", "Cannot read workspace cache"}};}
  }
  REACT_METHOD(WriteCache, L"writeCache");
  void WriteCache(std::string value, ReactPromise<void> promise) noexcept {
    try {FileLock guard; Replace(L"workspace-cache-v2.json", value); promise.Resolve();}
    catch (...) {promise.Reject("Cannot save workspace cache");}
  }
};
}
