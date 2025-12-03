# AWS SES Identity & Configuration Management - Inbound Project

*Working document for SES identity setup, rules, and configuration management (excluding email sending)*

## 🔧 Core SES Management Libraries

### 1. **`lib/aws-ses/aws-ses-rules.ts`** - SES Receipt Rules Manager
**Class**: `AWSSESReceiptRuleManager`

**Key Functions**:
- `configureEmailReceiving()` - Creates/updates receipt rules for domains
- `removeEmailReceiving()` - Removes receipt rules for domains  
- `configureCatchAllDomain()` - Sets up catch-all email rules
- `removeCatchAllDomain()` - Removes catch-all rules
- `configureMixedMode()` - Manages both individual and catch-all rules
- `restoreIndividualEmailRules()` - Restores individual email rules

**SES Operations Used**:
- `CreateReceiptRuleSetCommand`
- `CreateReceiptRuleCommand` 
- `UpdateReceiptRuleCommand`
- `DeleteReceiptRuleCommand`
- `DescribeReceiptRuleSetCommand`
- `SetActiveReceiptRuleSetCommand`

### 2. **`lib/domains-and-dns/domain-verification.ts`** - Domain Identity Verification
**Key Functions**:
- `initiateDomainVerification()` - Initiates SES domain verification
- `deleteDomainFromSES()` - Removes domain identities from SES

**SES Operations Used**:
- `VerifyDomainIdentityCommand`
- `GetIdentityVerificationAttributesCommand`
- `DeleteIdentityCommand`
- `SetIdentityMailFromDomainCommand`
- `GetIdentityMailFromDomainAttributesCommand`

### 3. **`lib/domains-and-dns/domain-management.ts`** - Domain Management
**Key Functions**:
- `listDomains()` - Enhanced domain listing with SES status
- `getDomainDetails()` - Detailed domain info including SES configuration
- `updateDomain()` - Domain settings updates
- `verifyDomainDnsRecords()` - DNS record verification for SES

## 🚀 API Endpoints

### 4. **`app/api/v2/domains/[id]/auth/route.ts`** - V2 Domain Authentication API
**Endpoints**:
- `POST /api/v2/domains/{id}/auth` - Initialize domain authentication
- `PATCH /api/v2/domains/{id}/auth` - Verify domain authentication

**SES Operations Used**:
- `VerifyDomainIdentityCommand`
- `VerifyDomainDkimCommand` 
- `SetIdentityMailFromDomainCommand`
- `GetIdentityVerificationAttributesCommand`
- `GetIdentityDkimAttributesCommand`
- `GetIdentityMailFromDomainAttributesCommand`

### 5. **`app/api/v2/domains/[id]/route.ts`** - V2 Domain Management API
**Endpoints**:
- `PUT /api/v2/domains/{id}` - Update domain settings

**SES Operations Used**:
- `GetIdentityVerificationAttributesCommand`
- `GetIdentityDkimAttributesCommand` 
- `GetIdentityMailFromDomainAttributesCommand`
- `SetIdentityMailFromDomainCommand`

### 6. **`app/api/inbound/verify-domain/route.ts`** - Domain Verification API
**Endpoints**:
- `POST /api/inbound/verify-domain` - Legacy domain verification endpoint

**Uses**: `initiateDomainVerification()` function

### 7. **Other API Endpoints Using SES Receipt Rules**:
- `app/api/v2/email-addresses/route.ts` - Email Address Management
- `app/api/v2/domains/route.ts` - Domain Creation/Management  
- `app/api/v1.1/email-addresses/route.ts` - V1.1 Email Address API
- `app/api/v1.1/domains/[id]/catch-all/route.ts` - V1.1 Catch-all API
- `app/api/inbound/configure-email/route.ts` - Legacy Configure Email API
- `app/api/domain/verifications/route.ts` - Domain Verifications API

## ⚡ Server Actions

### 8. **`app/actions/domains.ts`** - Domain Actions
**Functions**:
- Domain upgrade functions with SES MAIL FROM domain setup

**SES Operations Used**:
- `SetIdentityMailFromDomainCommand`
- `GetIdentityMailFromDomainAttributesCommand`

### 9. **`app/actions/primary.ts`** - Primary Actions
**Uses**: `configureEmailReceiving()` and `AWSSESReceiptRuleManager`

---

## 🔑 Key SES Identity & Configuration Operations Summary

### **Domain Identity Management**
- ✅ Domain verification token generation
- ✅ Domain identity verification status checking  
- ✅ Domain identity deletion
- ✅ DKIM setup and verification
- ✅ MAIL FROM domain configuration
- ✅ SPF and DMARC record generation

### **Receipt Rules Management**
- ✅ Receipt rule set creation and management
- ✅ Individual email address rules
- ✅ Catch-all domain rules
- ✅ Mixed mode configuration (individual + catch-all)
- ✅ Rule precedence management
- ✅ S3 storage configuration
- ✅ Lambda trigger configuration

### **DNS Records Management**
- ✅ SES verification TXT records
- ✅ DKIM CNAME records
- ✅ MAIL FROM domain MX records
- ✅ SPF TXT records
- ✅ DMARC TXT records
- ✅ DNS verification and status tracking

---

## 📦 AWS SDK Package Information

**Primary AWS SDK**: `@aws-sdk/client-ses` v3.817.0 (AWS SDK v3 for JavaScript)

**Other AWS Packages Used**:
- `@aws-sdk/client-s3` v3.817.0 - For S3 operations
- `@aws-sdk/client-lambda` v3.840.0 - For Lambda operations  
- `@aws-sdk/client-cloudwatch` v3.841.0 - For CloudWatch
- `@aws-sdk/client-cloudwatch-logs` v3.840.0 - For CloudWatch Logs

**Import Pattern** (Modular):
```typescript
import { 
  SESClient, 
  VerifyDomainIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  SetIdentityMailFromDomainCommand 
} from '@aws-sdk/client-ses'
```

**Key Benefits**:
- ✅ Smaller bundle size (only import what you need)
- ✅ Better tree-shaking support  
- ✅ TypeScript-first with better type safety
- ✅ Modern JavaScript (Promises, async/await)

## 🏢 AWS SES Tenant Management Research

### **What is SES Tenant Management?**

AWS SES Tenant Management allows you to create logical containers called "tenants" within your SES account. Each tenant can have:
- ✅ **Separate reputation profiles** - Issues with one tenant don't affect others
- ✅ **Isolated resources** - Own identities, configuration sets, templates
- ✅ **Independent monitoring** - Tenant-specific bounce/complaint rates
- ✅ **Automated enforcement** - Pause problematic tenants automatically

### **Current Architecture Analysis**

**Current User-Domain Structure:**
```sql
emailDomains
├── userId (direct association)
├── domain
├── status
└── verification details

emailAddresses  
├── userId (direct association)
├── domainId
└── endpoint associations
```

**Issues with Current Approach:**
- ❌ No tenant isolation - all users share same SES reputation
- ❌ One bad user can affect all others' deliverability  
- ❌ No fine-grained control over user email sending
- ❌ Difficult to implement user-level reputation policies

### **Proposed Tenant Architecture**

```sql
// New tenant tracking table needed
sesTenants
├── id (tenant-xxxx)
├── userId (1:1 relationship)
├── awsTenantId (from AWS CreateTenant API)
├── tenantName 
├── status ('active', 'paused', 'suspended')
├── reputationPolicy ('standard', 'strict', 'none')
└── created/updated timestamps

// Modified existing tables
emailDomains
├── userId (keep for backwards compatibility)
├── tenantId (NEW - references sesTenants)
└── [existing fields...]

emailAddresses
├── userId (keep for backwards compatibility) 
├── tenantId (NEW - references sesTenants)
└── [existing fields...]
```

### **Required AWS SES APIs**

**New APIs to Integrate:**
```javascript
// From @aws-sdk/client-ses
import {
  CreateTenantCommand,
  DeleteTenantCommand,
  GetTenantCommand,
  ListTenantsCommand,
  PutIdentityInTenantCommand,
  RemoveIdentityFromTenantCommand,
  UpdateTenantCommand
} from '@aws-sdk/client-ses'
```

### **Implementation Plan**

#### **Phase 1: Infrastructure Setup**
1. **Add tenant table to schema**
   - Create `sesTenants` table
   - Add `tenantId` columns to existing tables
   - Create migration scripts

2. **Create SES Tenant Manager**
   - New library: `lib/aws-ses/aws-ses-tenants.ts`
   - Wrap AWS tenant management APIs
   - Handle tenant lifecycle operations

#### **Phase 2: New User Flow** 
```javascript
// New user registration flow
async function onboardNewUser(userId: string) {
  // 1. Create AWS SES tenant
  const awsTenant = await createSESTenan(`user-${userId}`)
  
  // 2. Store tenant mapping in database
  const tenant = await createTenantRecord({
    userId,
    awsTenantId: awsTenant.TenantId,
    tenantName: `user-${userId}`,
    reputationPolicy: 'strict'
  })
  
  // 3. Future domain/identity creation automatically uses tenant
  return tenant
}
```

#### **Phase 3: Migration Strategy for Existing Users**

**Option A: Gradual Migration**
```javascript
async function migrateExistingUser(userId: string) {
  // 1. Create tenant for existing user
  const tenant = await createTenantForUser(userId)
  
  // 2. Get all user's existing identities
  const domains = await getUserDomains(userId)
  
  // 3. Associate existing identities with new tenant
  for (const domain of domains) {
    await putIdentityInTenant(domain.domain, tenant.awsTenantId)
    await updateDomainTenantId(domain.id, tenant.id)
  }
}
```

**Option B: Background Migration**
- Create tenants for all existing users
- Gradually migrate identities during normal operations
- Maintain backward compatibility during transition

#### **Phase 4: Updated Identity Creation Flow**
```javascript
async function createDomainWithTenant(userId: string, domain: string) {
  // 1. Get/create user's tenant
  const tenant = await getUserTenant(userId)
  
  // 2. Verify domain identity in AWS
  const identity = await verifyDomainIdentity(domain)
  
  // 3. Associate identity with tenant  
  await putIdentityInTenant(domain, tenant.awsTenantId)
  
  // 4. Store with tenant reference
  await createDomainRecord({
    domain,
    userId,
    tenantId: tenant.id, // NEW
    // ... other fields
  })
}
```

### **Key Benefits**

**For New Users:**
- ✅ Automatic tenant creation during onboarding
- ✅ Isolated reputation from day one
- ✅ Better deliverability protection

**For Existing Users:**
- ✅ Gradual migration without service disruption  
- ✅ Improved deliverability over time
- ✅ Protection from other users' reputation issues

**For Platform:**
- ✅ Granular control over user sending
- ✅ Ability to pause problematic users
- ✅ Better reputation management
- ✅ Compliance and isolation benefits

### **Considerations & Challenges**

**Technical:**
- 🤔 Requires database schema changes
- 🤔 Need migration strategy for existing users
- 🤔 Additional AWS API calls and complexity
- 🤔 Backward compatibility during transition

**Business:**
- 🤔 AWS may have tenant limits per account
- 🤔 Additional API costs for tenant management
- 🤔 Need monitoring for tenant reputation metrics

### **Next Steps**

1. **Research SDK Support** - Verify tenant management APIs in @aws-sdk/client-ses v3.817.0
2. **Design Database Schema** - Plan tenant table and migration strategy  
3. **Create Proof of Concept** - Build basic tenant creation/management
4. **Plan Migration Strategy** - Determine approach for existing users
5. **Update API Endpoints** - Modify domain/identity creation to use tenants

### **Questions for Investigation**

- ✅ **CONFIRMED**: Tenant management APIs ARE available in current SDK version (3.817.0)!
  - ✅ `CreateTenantCommand` - EXISTS
  - ✅ `PutIdentityInTenantCommand` - EXISTS  
  - ✅ `RemoveIdentityFromTenantCommand` - EXISTS
  - ✅ `GetTenantCommand` - EXISTS
  - ✅ `UpdateTenantCommand` - EXISTS
  - ✅ `ListTenantsCommand` - EXISTS
  - ✅ `DeleteTenantCommand` - EXISTS
- ❓ What are AWS limits on tenants per account?
- ❓ How do tenant operations affect existing SES quotas?
- ❓ Should we do 1:1 user:tenant or allow shared tenants?
- ❓ How to handle tenant reputation monitoring and alerting?

---

---

## 📋 **Research Summary**

Based on my research, AWS SES **does support multi-tenant architecture** through dedicated tenant management APIs. This would be a **significant improvement** for the Inbound project by providing:

**🎯 Core Benefits:**
- **Reputation Isolation** - Each user gets their own reputation profile
- **Automatic Enforcement** - AWS can pause problematic users automatically  
- **Better Deliverability** - Protection from other users' sending issues
- **Granular Control** - Fine-tuned management per user/tenant

**🏗️ Implementation Impact:**
- **Database Changes**: New `sesTenants` table + tenant foreign keys
- **New Code**: Tenant management library (`lib/aws-ses/aws-ses-tenants.ts`)
- **API Updates**: All identity creation must include tenant association
- **Migration Strategy**: Gradual transition for existing users

**⚠️ Critical Next Steps:**
1. ✅ **SDK Support Verified** - All tenant APIs available in v3.817.0
2. **Test AWS Limits** - Understand tenant quotas per account
3. **Design Migration** - Plan zero-downtime transition strategy
4. **Build Proof of Concept** - Test tenant creation and identity association

**🤔 Key Decision Points:**
- 1:1 user:tenant relationship vs shared tenants
- Migration timeline (immediate vs gradual)
- Backward compatibility requirements
- Monitoring and alerting strategy

## 🎉 **BREAKTHROUGH: SDK SUPPORT CONFIRMED**

**✅ EXCELLENT NEWS**: All AWS SES tenant management APIs are **FULLY AVAILABLE** in your current SDK version!

**Tested and Confirmed Available:**
```javascript
import {
  CreateTenantCommand,
  PutIdentityInTenantCommand,
  RemoveIdentityFromTenantCommand,
  GetTenantCommand,
  UpdateTenantCommand,
  ListTenantsCommand,
  DeleteTenantCommand
} from '@aws-sdk/client-ses' // v3.817.0 ✅
```

This means **no SDK upgrade is required** and you can start implementing tenant management **immediately**!

This research shows that **tenant management would significantly improve** the platform's email deliverability and user isolation, and **all technical prerequisites are met**.

---

## 📝 Working Notes

*Use this section for ongoing development notes*
