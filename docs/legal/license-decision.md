# Legal Decision: Apache-2.0 License and DCO vs CLA

This document elaborates on the legal rationale for choosing the **Apache-2.0 License** and the **Developer Certificate of Origin (DCO)** over alternative models like Contributor License Agreements (CLAs) or GPL copyleft licenses.

---

## 1. Why Apache-2.0 (and Not MIT or GPL)?

### Compared to MIT / BSD
While MIT and BSD are simple and permissive, they lack an **explicit patent grant** and patent retaliation clause. The Apache License 2.0 (Section 3) explicitly protects users and contributors from patent infringement assertions by any contributor regarding their contributions.

### Compared to GPLv3 / AGPLv3
Strong copyleft licenses like GPL/AGPL create significant adoption barriers in enterprise environments, where platform engineering teams and enterprises need clear legal certainty when integrating the tool into internal workflows without risking reciprocal licensing mandates.

---

## 2. Why DCO (and Not a Corporate CLA)?

### Contributor Experience
Corporate CLAs (e.g. CLA Assistant, EasyCLA) require:
- Signing agreements via web portals.
- Approvals from corporate legal departments.
- Management of employee whitelist lists.

This creates substantial friction for casual or external contributors.

### Legal Sufficiency of DCO
The Linux kernel, Git, Docker/Moby, and the CNCF (Cloud Native Computing Foundation) use the **Developer Certificate of Origin (DCO)**. The DCO provides a legally binding assertion that the contributor created or has rights to submit the code under the project's open-source license.

Using `git commit -s` provides full code provenance tracking in the Git commit history without requiring a proprietary CLA database.
