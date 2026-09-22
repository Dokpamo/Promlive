#pragma once
#include "NativeModules.h"
#include <wincred.h>
#include <memory>
#include <stdexcept>

#pragma comment(lib, "Advapi32.lib")

namespace winrt::Microsoft::ReactNative {
REACT_MODULE(PromliveCredentials);
struct PromliveCredentials {
  static std::wstring Target(const std::string &reference) {
    if (reference.rfind("com.promlive.ai.", 0) != 0 || reference.size() > 200)
      throw std::runtime_error("Invalid credential reference");
    return std::wstring(winrt::to_hstring(reference));
  }

  REACT_METHOD(Get, L"get");
  void Get(std::string reference, ReactPromise<JSValue> promise) noexcept {
    try {
      const auto target = Target(reference);
      PCREDENTIALW raw = nullptr;
      if (!CredReadW(target.c_str(), CRED_TYPE_GENERIC, 0, &raw)) {
        if (GetLastError() == ERROR_NOT_FOUND) {promise.Resolve(JSValue{}); return;}
        throw std::runtime_error("Cannot read API key");
      }
      std::unique_ptr<CREDENTIALW, decltype(&CredFree)> saved(raw, CredFree);
      promise.Resolve(JSValue(std::string(reinterpret_cast<const char *>(saved->CredentialBlob), saved->CredentialBlobSize)));
    } catch (...) {promise.Reject("Cannot read API key");}
  }

  REACT_METHOD(Set, L"set");
  void Set(std::string reference, std::string secret, ReactPromise<void> promise) noexcept {
    try {
      auto target = Target(reference);
      if (secret.size() > CRED_MAX_CREDENTIAL_BLOB_SIZE) throw std::runtime_error("API key too long");
      CREDENTIALW value{};
      value.Type = CRED_TYPE_GENERIC;
      value.TargetName = target.data();
      value.CredentialBlob = reinterpret_cast<LPBYTE>(secret.data());
      value.CredentialBlobSize = static_cast<DWORD>(secret.size());
      value.Persist = CRED_PERSIST_LOCAL_MACHINE;
      if (!CredWriteW(&value, 0)) throw std::runtime_error("Cannot save API key");
      SecureZeroMemory(secret.data(), secret.size());
      promise.Resolve();
    } catch (...) {SecureZeroMemory(secret.data(), secret.size()); promise.Reject("Cannot save API key");}
  }

  REACT_METHOD(Remove, L"remove");
  void Remove(std::string reference, ReactPromise<void> promise) noexcept {
    try {
      const auto target = Target(reference);
      if (!CredDeleteW(target.c_str(), CRED_TYPE_GENERIC, 0) && GetLastError() != ERROR_NOT_FOUND)
        throw std::runtime_error("Cannot remove API key");
      promise.Resolve();
    } catch (...) {promise.Reject("Cannot remove API key");}
  }
};
}
